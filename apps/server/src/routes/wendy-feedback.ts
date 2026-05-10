/**
 * POST /api/v1/ai/feedback        — Human-in-the-Loop feedback (up/down)
 * GET  /api/v1/ai/feedback/stats  — Admin: statistiche aggregate (rate-limited)
 *
 * v2.2 changes:
 *   [FB-1] Schema unificato: usa wendy_message_feedback (migration 0041)
 *          invece di due tabelle separate (wendy_feedback + wendy_memory).
 *          Campi allineati: rating INT (1/-1) invece di vote TEXT ('up'/'down'),
 *          context_snapshot JSONB invece di context JSONB.
 *   [FB-2] GET /stats: aggiunto rate-limit 10 req/min per admin
 *          (impedisce query pesanti in loop accidentale)
 *   [FB-3] Risposta POST ora include { ok, alreadyVoted } per UX ottimistica
 *   [FB-4] Stats: usa vista v_wendy_feedback_stats (migration 0041) più efficiente
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/requireAuth.js';
import { rateLimit } from 'express-rate-limit';
import { db } from '@workspace/db';
import { logger } from '../lib/logger.js';

export const wendyFeedbackRouter = Router();

// ─── Rate limiters ───────────────────────────────────────────────────────────────

const feedbackWriteLimit = rateLimit({
  windowMs: 60_000,
  max:      30,  // 30 voti/min è già molto generoso per click umani
  keyGenerator: (req: Request) =>
    (req as Request & { user?: { id: string } }).user?.id ?? 'anon',
  validate: { ip: false },
  message: { error: 'Troppi feedback. Attendi un minuto.', code: 'RATE_LIMIT' },
});

// [FB-2] Rate limit specifico per admin stats — query pesante su DB
const statsReadLimit = rateLimit({
  windowMs: 60_000,
  max:      10,
  keyGenerator: (req: Request) =>
    (req as Request & { user?: { id: string } }).user?.id ?? 'anon',
  validate: { ip: false },
  message: { error: 'Troppe richieste stats. Attendi un minuto.', code: 'RATE_LIMIT' },
});

// ─── Schema ────────────────────────────────────────────────────────────────────────

// [FB-1] rating: 1 = thumbs-up, -1 = thumbs-down
//        Allineato con wendy_message_feedback.rating CHECK (rating IN (1,-1))
const FeedbackBodySchema = z.object({
  messageId:       z.string().min(1).max(100),
  conversationId:  z.string().max(100).optional(),
  rating:          z.union([
    z.literal(1),
    z.literal(-1),
    // Retrocompatibilità: accetta ancora 'up'/'down' e li converte
    z.literal('up').transform(() => 1   as 1),
    z.literal('down').transform(() => -1 as -1),
  ]),
  feedbackText:    z.string().max(1000).nullable().optional(),
  contextSnapshot: z.record(z.unknown()).optional(),
});

// ─── Route: POST /feedback ───────────────────────────────────────────────────────────

wendyFeedbackRouter.post(
  '/feedback',
  requireAuth,
  feedbackWriteLimit,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) { res.status(401).json({ error: 'Non autenticato' }); return; }

    const parsed = FeedbackBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Body non valido', details: parsed.error.flatten() });
      return;
    }

    const { messageId, conversationId, rating, feedbackText, contextSnapshot } = parsed.data;

    try {
      // [FB-1] INSERT su wendy_message_feedback (migration 0041).
      //        ON CONFLICT: aggiorna il rating se l'utente cambia voto.
      // [FB-3] Rileva se era già un voto esistente (alreadyVoted) per UX ottimistica.
      const result = await db.execute<{ was_update: boolean }>(`
        INSERT INTO wendy_message_feedback
          (user_id, message_id, conversation_id, rating, feedback_text, context_snapshot, created_at)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, NOW())
        ON CONFLICT (user_id, message_id) DO UPDATE
          SET rating          = EXCLUDED.rating,
              feedback_text   = EXCLUDED.feedback_text,
              context_snapshot = EXCLUDED.context_snapshot
        RETURNING (xmax <> 0) AS was_update
      `, [
        userId,
        messageId,
        conversationId ?? null,
        rating,
        feedbackText ?? null,
        JSON.stringify(contextSnapshot ?? {}),
      ]);

      const alreadyVoted = result[0]?.was_update ?? false;

      if (rating === -1) {
        logger.warn(
          { userId, messageId, conversationId, feedbackText, contextSnapshot },
          '[wendy-feedback] downvote — candidato a revisione umana',
        );
      } else {
        logger.info({ userId, messageId }, '[wendy-feedback] upvote');
      }

      // [FB-3] { ok, alreadyVoted } permette al frontend di mostrare
      //        "Grazie per il feedback!" vs "Voto aggiornato"
      res.json({ ok: true, alreadyVoted });

    } catch (err) {
      logger.error({ err, userId }, '[wendy-feedback] salvataggio fallito');
      res.status(500).json({ error: 'Impossibile salvare il feedback' });
    }
  },
);

// ─── Route: GET /feedback/stats (admin) ────────────────────────────────────────────────

wendyFeedbackRouter.get(
  '/feedback/stats',
  requireAuth,
  statsReadLimit,  // [FB-2]
  async (req: Request, res: Response): Promise<void> => {
    const user = (req as Request & { user?: { id: string; role?: string } }).user;
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Accesso riservato agli admin' });
      return;
    }

    try {
      // [FB-4] Usa la vista v_wendy_feedback_stats (migration 0041)
      //        che raggruppa già per day/model/use_case con indici appropriati.
      const dailyStats = await db.execute<{
        day:              string;
        total_votes:      number;
        thumbs_up:        number;
        thumbs_down:      number;
        satisfaction_pct: number | null;
        model:            string | null;
        use_case:         string | null;
      }>(`
        SELECT day, total_votes, thumbs_up, thumbs_down, satisfaction_pct, model, use_case
        FROM v_wendy_feedback_stats
        WHERE day >= NOW() - INTERVAL '30 days'
        ORDER BY day DESC
        LIMIT 200
      `);

      // Totali aggregati degli ultimi 30 giorni
      const totals = dailyStats.reduce(
        (acc, r) => ({
          up:   acc.up   + Number(r.thumbs_up),
          down: acc.down + Number(r.thumbs_down),
        }),
        { up: 0, down: 0 },
      );
      const total = totals.up + totals.down;

      // Ultimi downvote con feedback testuale (per revisione umana)
      const recentDownvotes = await db.execute<{
        message_id:      string;
        conversation_id: string | null;
        feedback_text:   string | null;
        context_snapshot: unknown;
        created_at:      string;
      }>(`
        SELECT message_id, conversation_id, feedback_text, context_snapshot, created_at
        FROM wendy_message_feedback
        WHERE rating = -1
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 50
      `);

      res.json({
        period:           '30d',
        upvotes:          totals.up,
        downvotes:        totals.down,
        satisfaction_pct: total > 0 ? Math.round((totals.up / total) * 100) : null,
        daily:            dailyStats,
        recent_downvotes: recentDownvotes,
      });

    } catch (err) {
      logger.error({ err }, '[wendy-feedback] stats query fallita');
      res.status(500).json({ error: 'Errore nel calcolo statistiche' });
    }
  },
);
