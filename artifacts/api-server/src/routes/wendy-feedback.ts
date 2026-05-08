/**
 * POST /api/v1/ai/chat/feedback — Human-in-the-Loop feedback
 *
 * Riceve il voto 👍/👎 dell'utente su una risposta di Wendy e:
 *   1. Persiste il record in `wendy_feedback` per analisi admin
 *   2. Aggiorna il contatore aggregato su `wendy_memory` dell'utente
 *      (upvotes / downvotes totali — usati per adattare il tono Premium)
 *   3. Logga i downvotes con nota per revisione umana
 *
 * Schema DB:
 *   wendy_feedback
 *     id          SERIAL PRIMARY KEY
 *     user_id     TEXT REFERENCES users(id) ON DELETE CASCADE
 *     message_id  TEXT NOT NULL            -- ID client del messaggio (es. "assistant-1746700800000")
 *     vote        TEXT CHECK (vote IN ('up','down'))
 *     note        TEXT                     -- nota opzionale (solo downvote)
 *     context     JSONB                    -- ultimi 2 messaggi [{role,content}] per analisi
 *     created_at  TIMESTAMPTZ DEFAULT NOW()
 *
 * Aggregati su wendy_memory:
 *   upvotes_total   INT DEFAULT 0
 *   downvotes_total INT DEFAULT 0
 *   avg_rating      FLOAT GENERATED ALWAYS AS (
 *     CASE WHEN (upvotes_total + downvotes_total) = 0 THEN NULL
 *          ELSE upvotes_total::float / (upvotes_total + downvotes_total) END
 *   ) STORED
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth-jwt.js';
import { db } from '../storage.js';
import { logger } from '../lib/logger.js';

export const wendyFeedbackRouter = Router();

// ─── Schema ───────────────────────────────────────────────────────────────────
const FeedbackBodySchema = z.object({
  messageId: z.string().min(1).max(100),
  vote:      z.enum(['up', 'down']),
  note:      z.string().max(500).nullable().optional(),
  context:   z.array(
    z.object({
      role:    z.enum(['user', 'assistant', 'error']),
      content: z.string().max(500),
    })
  ).max(4).optional(),
});

// ─── Route ────────────────────────────────────────────────────────────────────
wendyFeedbackRouter.post(
  '/feedback',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non autenticato' });
      return;
    }

    const parsed = FeedbackBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Body non valido', details: parsed.error.flatten() });
      return;
    }

    const { messageId, vote, note, context } = parsed.data;

    try {
      // ── 1. Persiste il feedback ─────────────────────────────────────────────────
      await db.execute(`
        INSERT INTO wendy_feedback (user_id, message_id, vote, note, context, created_at)
        VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
        ON CONFLICT (user_id, message_id) DO UPDATE
          SET vote = EXCLUDED.vote,
              note = EXCLUDED.note
      `, [
        userId,
        messageId,
        vote,
        note ?? null,
        JSON.stringify(context ?? []),
      ]);

      // ── 2. Aggiorna contatori aggregati in wendy_memory ────────────────────────
      const voteCol = vote === 'up' ? 'upvotes_total' : 'downvotes_total';
      await db.execute(`
        INSERT INTO wendy_memory (user_id, sessions, ${voteCol}, updated_at)
        VALUES ($1, '[]'::jsonb, 1, NOW())
        ON CONFLICT (user_id) DO UPDATE
          SET ${voteCol} = COALESCE(wendy_memory.${voteCol}, 0) + 1,
              updated_at = NOW()
      `, [userId]);

      // ── 3. Log downvotes con nota per revisione umana ────────────────────────
      if (vote === 'down') {
        logger.warn(
          { userId, messageId, note, context },
          '[wendy-feedback] downvote ricevuto — candidato a revisione umana',
        );
      } else {
        logger.info({ userId, messageId }, '[wendy-feedback] upvote ricevuto');
      }

      res.json({ ok: true });
    } catch (err) {
      logger.error({ err, userId }, '[wendy-feedback] salvataggio feedback fallito');
      res.status(500).json({ error: 'Impossibile salvare il feedback' });
    }
  },
);

// ─── Admin: statistiche aggregate ──────────────────────────────────────────────────
// GET /api/v1/ai/chat/feedback/stats — solo admin
// Ritorna: totale up/down, tasso di soddisfazione, ultimi downvote con nota
wendyFeedbackRouter.get(
  '/feedback/stats',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as Request & { user?: { id: string; role?: string } }).user;
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Accesso riservato agli admin' });
      return;
    }

    try {
      const [totals] = await db.execute<{
        up:         number;
        down:       number;
        with_note:  number;
      }>(`
        SELECT
          COUNT(*) FILTER (WHERE vote = 'up')   AS up,
          COUNT(*) FILTER (WHERE vote = 'down') AS down,
          COUNT(*) FILTER (WHERE vote = 'down' AND note IS NOT NULL AND note <> '') AS with_note
        FROM wendy_feedback
        WHERE created_at > NOW() - INTERVAL '30 days'
      `);

      const recent_downvotes = await db.execute<{
        message_id: string;
        note:       string | null;
        context:    unknown;
        created_at: string;
      }>(`
        SELECT message_id, note, context, created_at
        FROM wendy_feedback
        WHERE vote = 'down'
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 50
      `);

      const up   = Number(totals?.up   ?? 0);
      const down = Number(totals?.down ?? 0);
      const total = up + down;

      res.json({
        period:           '30d',
        upvotes:          up,
        downvotes:        down,
        satisfaction_pct: total > 0 ? Math.round((up / total) * 100) : null,
        recent_downvotes,
      });
    } catch (err) {
      logger.error({ err }, '[wendy-feedback] stats query fallita');
      res.status(500).json({ error: 'Errore nel calcolo statistiche' });
    }
  },
);
