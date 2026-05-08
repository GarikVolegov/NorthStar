/**
 * POST /api/v1/ai/chat/stream — Endpoint SSE Wendy
 *
 * Flusso per ogni richiesta:
 *   1. Autenticazione JWT (requireAuth middleware)
 *   2. Validazione body (zod)
 *   3. Rate limiting specifico per chat AI (10 req/min per utente)
 *   4. Caricamento memoria a lungo termine → system prompt personalizzato
 *   5. Streaming SSE via ai.streamChat() → groq con fallback openai
 *   6. Salvataggio riassunto sessione in background (non blocca la risposta)
 *
 * Formato SSE emesso:
 *   data: {"choices":[{"delta":{"content":"chunk"}}]}\n\n
 *   data: [DONE]\n\n
 *
 * Errori HTTP:
 *   400 — body non valido
 *   401 — non autenticato
 *   429 — rate limit superato
 *   500 — errore AI (con body JSON { error, code })
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth-jwt.js';
import { ai } from '../lib/ai/index.js';
import { loadWendyContext, saveSessionSummary } from '../lib/wendy-memory.js';
import { rateLimit } from 'express-rate-limit';
import { logger } from '../lib/logger.js';

export const wendyChatRouter = Router();

// ─── Rate limiter specifico chat AI ──────────────────────────────────────────
// 10 richieste / minuto per utente — abbastanza per conversazione fluente
const chatRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req: Request) => (req as Request & { user?: { id: string } }).user?.id ?? req.ip ?? 'anon',
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Troppi messaggi. Attendi un momento.', code: 'RATE_LIMIT' },
});

// ─── Schema validazione body ──────────────────────────────────────────────────
const ChatBodySchema = z.object({
  message: z.string().min(1).max(4000),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().max(8000),
    })
  ).max(30).default([]),
});

// ─── Route principale ─────────────────────────────────────────────────────────
wendyChatRouter.post(
  '/stream',
  requireAuth,
  chatRateLimiter,
  async (req: Request, res: Response) => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) return res.status(401).json({ error: 'Non autenticato', code: 'UNAUTHORIZED' });

    // ── 1. Validazione ──────────────────────────────────────────────────────
    const parsed = ChatBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Body non valido',
        details: parsed.error.flatten(),
      });
    }
    const { message, history } = parsed.data;

    // ── 2. Intestazioni SSE ─────────────────────────────────────────────────
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // disabilita buffering nginx
    res.flushHeaders();

    // ── 3. Carica memoria a lungo termine ───────────────────────────────────
    const { systemPrompt, memoryLoaded } = await loadWendyContext(userId);
    if (!memoryLoaded) {
      logger.warn({ userId }, '[wendy-chat] memoria non caricata — rispondo senza contesto');
    }

    // ── 4. Costruisce messages array ────────────────────────────────────────
    // Struttura: [system, ...history (max 20), utente corrente]
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-20),
      { role: 'user', content: message },
    ];

    // ── 5. Streaming SSE ────────────────────────────────────────────────────
    let fullResponse = '';
    let clientDisconnected = false;

    req.on('close', () => { clientDisconnected = true; });

    try {
      for await (const chunk of ai.streamChat({
        useCase: 'streaming_chat',
        messages,
        temperature: 0.75,
        maxTokens: 1024,
      })) {
        if (clientDisconnected) break;

        fullResponse += chunk;

        // Formato compatibile OpenAI SSE → letto da useSSEStream.ts
        const ssePayload = JSON.stringify({
          choices: [{ delta: { content: chunk } }],
        });
        res.write(`data: ${ssePayload}\n\n`);
      }

      // Segnale di fine stream
      if (!clientDisconnected) {
        res.write('data: [DONE]\n\n');
      }

    } catch (err: unknown) {
      logger.error({ err, userId }, '[wendy-chat] stream error');

      if (!res.headersSent) {
        return res.status(500).json({ error: 'Errore AI', code: 'AI_ERROR' });
      }

      // Se gli header SSE sono già stati mandati, invia l'errore come evento
      if (!clientDisconnected) {
        const errPayload = JSON.stringify({
          error: err instanceof Error ? err.message : 'AI_ERROR',
          code: 'STREAM_ERROR',
        });
        res.write(`event: error\ndata: ${errPayload}\n\n`);
      }
    } finally {
      res.end();
    }

    // ── 6. Salvataggio memoria (background, non blocca) ──────────────────────
    if (fullResponse && !clientDisconnected) {
      const allMessages = [
        ...messages,
        { role: 'assistant', content: fullResponse },
      ];
      // fire-and-forget — errori loggati internamente
      saveSessionSummary(userId, allMessages).catch(() => {});
    }
  }
);
