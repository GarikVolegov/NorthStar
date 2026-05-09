/**
 * POST /api/v1/ai/chat/stream — Endpoint SSE Wendy
 *
 * Pipeline per ogni richiesta:
 *   1. Autenticazione JWT
 *   2. Validazione body (zod)
 *   3. Rate limiting (10 req/min per utente)
 *   4. Caricamento memoria a lungo termine → system prompt personalizzato
 *   5. RAG retrieval dalla knowledge base NorthStar
 *   6. Emit evento SSE "rag_citations" con le fonti trovate (prima del testo)
 *   7. Streaming SSE testo via ai.streamChat() → groq + fallback openai
 *   8. Salvataggio riassunto sessione in background
 *
 * Formato SSE emesso (in ordine):
 *   data: {"type":"rag_citations","citations":[...],"durationMs":N}\n\n
 *   data: {"choices":[{"delta":{"content":"chunk"}}]}\n\n   (N volte)
 *   data: [DONE]\n\n
 *
 * Errori HTTP:
 *   400 — body non valido
 *   401 — non autenticato
 *   429 — rate limit superato
 *   500 — errore AI (body JSON { error, code })
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middlewares/requireAuth.js';
import { ai } from '../lib/ai/index.js';
import { loadWendyContext, saveSessionSummary } from '../lib/wendy-memory.js';
import { retrieveKnowledge } from '../lib/wendy-rag.js';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { logger } from '../lib/logger.js';

export const wendyChatRouter = Router();

// ─── Rate limiter ─────────────────────────────────────────────────────────────
const chatRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req: Request) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    return userId ? `user:${userId}` : ipKeyGenerator(req);
  },
  standardHeaders: true,
  legacyHeaders:   false,
  message: { error: 'Troppi messaggi. Attendi un momento.', code: 'RATE_LIMIT' },
});

// ─── Schema ───────────────────────────────────────────────────────────────────
const ChatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  history: z
    .array(z.object({
      role:    z.enum(['user', 'assistant']),
      content: z.string().max(8000),
    }))
    .max(30)
    .default([]),
  /**
   * Se true, Wendy NON esegue il RAG retrieval per questo messaggio.
   * Utile per domande generiche tipo "Ciao" o "Come stai".
   * Il frontend può impostarlo a false di default e true solo per
   * saluti o chit-chat rilevati lato client.
   */
  skipRag: z.boolean().default(false),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type SseRes = Response;

function sendSSE(res: SseRes, payload: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// ─── Route ────────────────────────────────────────────────────────────────────
wendyChatRouter.post(
  '/stream',
  requireAuth,
  chatRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Non autenticato', code: 'UNAUTHORIZED' });
      return;
    }

    // ── 1. Validazione ──────────────────────────────────────────────────────
    const parsed = ChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Body non valido', details: parsed.error.flatten() });
      return;
    }
    const { message, history, skipRag } = parsed.data;

    // ── 2. Intestazioni SSE ─────────────────────────────────────────────────
    res.setHeader('Content-Type',    'text/event-stream');
    res.setHeader('Cache-Control',   'no-cache');
    res.setHeader('Connection',      'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });

    // ── 3. Memoria a lungo termine + RAG (parallelo) ────────────────────────
    const [wendyCtx, ragResult] = await Promise.all([
      loadWendyContext(userId),
      skipRag ? Promise.resolve({ chunks: [], contextBlock: '', durationMs: 0, fromCache: false })
              : retrieveKnowledge(message, userId),
    ]);

    if (!wendyCtx.memoryLoaded) {
      logger.warn({ userId }, '[wendy-chat] memoria non caricata');
    }

    // ── 4. Emit citations prima dello streaming ──────────────────────────────
    // Il frontend può mostrare le fonti KB come badge/card prima che il testo
    // arrivi, migliorando la percezione di velocità e trasparenza.
    if (ragResult.chunks.length > 0 && !clientDisconnected) {
      sendSSE(res, {
        type:       'rag_citations',
        citations:  ragResult.chunks.map((c) => ({
          nodeId: c.nodeId,
          title:  c.title,
          type:   c.type,
          score:  Math.round(c.score * 100),  // percentuale per il frontend
          url:    c.url ?? null,
        })),
        durationMs: ragResult.durationMs,
      });
    }

    // ── 5. Costruisce messages array ─────────────────────────────────────────
    // System prompt = persona Wendy + profilo RIASEC + [KB block se trovata]
    const systemContent = ragResult.contextBlock
      ? `${wendyCtx.systemPrompt}\n\n${ragResult.contextBlock}`
      : wendyCtx.systemPrompt;

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system',    content: systemContent },
      ...history.slice(-20),
      { role: 'user',      content: message },
    ];

    // ── 6. Streaming SSE ────────────────────────────────────────────────────
    let fullResponse = '';

    try {
      for await (const chunk of ai.streamChat({
        useCase:     'streaming_chat',
        messages,
        temperature: 0.70,
        maxTokens:   1024,
      })) {
        if (clientDisconnected) break;
        fullResponse += chunk;
        sendSSE(res, { choices: [{ delta: { content: chunk } }] });
      }

      if (!clientDisconnected) res.write('data: [DONE]\n\n');

    } catch (err: unknown) {
      logger.error({ err, userId }, '[wendy-chat] stream error');
      if (!clientDisconnected) {
        const errPayload = JSON.stringify({
          error: err instanceof Error ? err.message : 'AI_ERROR',
          code:  'STREAM_ERROR',
        });
        res.write(`event: error\ndata: ${errPayload}\n\n`);
      }
    } finally {
      res.end();
    }

    // ── 7. Salvataggio sessione (background) ─────────────────────────────────
    if (fullResponse && !clientDisconnected) {
      saveSessionSummary(userId, [
        ...messages,
        { role: 'assistant', content: fullResponse },
      ]).catch(() => {});
    }
  },
);
