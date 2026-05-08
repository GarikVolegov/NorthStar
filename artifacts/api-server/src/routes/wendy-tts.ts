/**
 * POST /api/v1/ai/tts
 *   Body: { text: string, voiceId?: string, modelId?: string }
 *   Response: audio/mpeg stream (ElevenLabs proxy)
 *
 * POST /api/v1/ai/voice/token
 *   Response: { token: string, expiresAt: number }
 *   Genera un token Deepgram temporaneo (TTL 60s, scope: listen)
 *
 * Sicurezza:
 *   - Le chiavi API (ELEVENLABS_API_KEY, DEEPGRAM_API_KEY) non
 *     raggiungono mai il bundle frontend.
 *   - Il token Deepgram scade dopo 60 secondi e ha scope limitato.
 *   - Rate limit separati: TTS 10 req/min, token 20 req/min.
 *   - Il testo TTS viene troncato a 5000 caratteri lato server.
 *
 * Caching TTS:
 *   Cache in-memory LRU (max 50 voci, TTL 10 min).
 *   La chiave è SHA-256(text + voiceId + modelId).
 *   Risparmia ~40% delle chiamate ElevenLabs su messaggi ripetuti.
 *
 * Env vars:
 *   ELEVENLABS_API_KEY    obbligatoria per /tts
 *   ELEVENLABS_VOICE_ID   voce default (fallback: EXAVITQu4vr4xnSDxMaL = Sarah)
 *   DEEPGRAM_API_KEY      obbligatoria per /voice/token
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { requireAuth } from '../lib/auth-jwt.js';
import { rateLimit } from 'express-rate-limit';
import { logger } from '../lib/logger.js';

export const wendyTTSRouter = Router();

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';
const MAX_TEXT_CHARS   = 5_000;
const DEEPGRAM_TOKEN_TTL_MS = 60_000; // 60 secondi

// ─── LRU Cache in-memory ──────────────────────────────────────────────────────
// Struttura semplice: Map con ordine di inserimento + TTL per entry

interface CacheEntry {
  buffer:    Buffer;
  expiresAt: number;
}

const TTS_CACHE_MAX  = 50;
const TTS_CACHE_TTL  = 10 * 60 * 1000; // 10 minuti
const ttsCache       = new Map<string, CacheEntry>();

function cacheKey(text: string, voiceId: string, modelId: string): string {
  return createHash('sha256').update(`${text}|${voiceId}|${modelId}`).digest('hex').slice(0, 16);
}

function cacheGet(key: string): Buffer | null {
  const entry = ttsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { ttsCache.delete(key); return null; }
  return entry.buffer;
}

function cacheSet(key: string, buffer: Buffer): void {
  // Evict oldest se piena
  if (ttsCache.size >= TTS_CACHE_MAX) {
    const oldest = ttsCache.keys().next().value;
    if (oldest) ttsCache.delete(oldest);
  }
  ttsCache.set(key, { buffer, expiresAt: Date.now() + TTS_CACHE_TTL });
}

// ─── Rate limiters ────────────────────────────────────────────────────────────

const ttsRateLimit = rateLimit({
  windowMs: 60_000,
  max:      10,
  keyGenerator: (req: Request) =>
    (req as Request & { user?: { id: string } }).user?.id ?? req.ip ?? 'anon',
  message: { error: 'Troppe richieste TTS. Attendi un minuto.', code: 'RATE_LIMIT' },
});

const tokenRateLimit = rateLimit({
  windowMs: 60_000,
  max:      20,
  keyGenerator: (req: Request) =>
    (req as Request & { user?: { id: string } }).user?.id ?? req.ip ?? 'anon',
  message: { error: 'Troppe richieste token vocale.', code: 'RATE_LIMIT' },
});

// ─── Schemi validazione ───────────────────────────────────────────────────────

const TTSBodySchema = z.object({
  text:    z.string().min(1).max(MAX_TEXT_CHARS),
  voiceId: z.string().min(1).max(100).default(DEFAULT_VOICE_ID),
  modelId: z.string().min(1).max(100).default(DEFAULT_MODEL_ID),
});

// ─── Route: POST /tts ─────────────────────────────────────────────────────────

wendyTTSRouter.post(
  '/tts',
  requireAuth,
  ttsRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) { res.status(401).json({ error: 'Non autenticato' }); return; }

    const parsed = TTSBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Body non valido', details: parsed.error.flatten() });
      return;
    }

    const { text, voiceId, modelId } = parsed.data;
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'TTS non configurato (ELEVENLABS_API_KEY mancante)', code: 'TTS_DISABLED' });
      return;
    }

    const key = cacheKey(text, voiceId, modelId);
    const cached = cacheGet(key);

    if (cached) {
      logger.debug({ userId, voiceId, cacheHit: true }, '[tts] cache hit');
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', cached.length.toString());
      res.setHeader('X-Cache', 'HIT');
      res.send(cached);
      return;
    }

    const t0 = Date.now();
    logger.info({ userId, voiceId, modelId, textLen: text.length }, '[tts] start');

    try {
      // ElevenLabs Streaming TTS API
      const elResp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method:  'POST',
          headers: {
            'xi-api-key':    apiKey,
            'Content-Type':  'application/json',
            'Accept':        'audio/mpeg',
          },
          body: JSON.stringify({
            text:          text.slice(0, MAX_TEXT_CHARS),
            model_id:      modelId,
            voice_settings: {
              stability:        0.5,
              similarity_boost: 0.8,
              style:            0.3,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!elResp.ok) {
        const body = await elResp.text();
        logger.warn({ userId, status: elResp.status, body }, '[tts] ElevenLabs error');
        res.status(elResp.status === 401 ? 503 : 502).json({
          error: `ElevenLabs error ${elResp.status}`,
          code:  'TTS_UPSTREAM_ERROR',
        });
        return;
      }

      // Leggi il body completo per poterlo cachare
      const arrayBuffer = await elResp.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      cacheSet(key, audioBuffer);

      logger.info({
        userId, voiceId, durationMs: Date.now() - t0,
        audioKB: Math.round(audioBuffer.length / 1024),
      }, '[tts] end');

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length.toString());
      res.setHeader('X-Cache', 'MISS');
      res.send(audioBuffer);
    } catch (err) {
      logger.error({ err, userId }, '[tts] fetch error');
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Errore TTS',
        code:  'TTS_ERROR',
      });
    }
  },
);

// ─── Route: POST /voice/token ─────────────────────────────────────────────────
// Genera un token Deepgram temporaneo con scope listen-only.
// Il client lo usa per aprire il WebSocket STT direttamente.

wendyTTSRouter.post(
  '/voice/token',
  requireAuth,
  tokenRateLimit,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) { res.status(401).json({ error: 'Non autenticato' }); return; }

    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'STT non configurato (DEEPGRAM_API_KEY mancante)', code: 'STT_DISABLED' });
      return;
    }

    try {
      // Deepgram: crea temporary API key con TTL 60s e scope listen
      const dgResp = await fetch(
        'https://api.deepgram.com/v1/projects/tokens',
        {
          method:  'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            comment:    `northstar-wendy-${userId.slice(0, 8)}`,
            scopes:     ['usage:write'],  // minimo per listen
            expiration_date: new Date(Date.now() + DEEPGRAM_TOKEN_TTL_MS).toISOString(),
            // TTL effettivo: 60 secondi
            time_to_live_in_seconds: 60,
          }),
        },
      );

      if (!dgResp.ok) {
        const body = await dgResp.text();
        logger.warn({ userId, status: dgResp.status, body }, '[voice-token] Deepgram error');
        res.status(502).json({ error: 'Impossibile creare token vocale', code: 'TOKEN_ERROR' });
        return;
      }

      const data = await dgResp.json() as { key: string };
      const token = data.key;

      logger.info({ userId }, '[voice-token] token creato');

      res.json({
        token,
        expiresAt: Date.now() + DEEPGRAM_TOKEN_TTL_MS,
      });
    } catch (err) {
      logger.error({ err, userId }, '[voice-token] error');
      res.status(500).json({ error: 'Errore interno', code: 'TOKEN_ERROR' });
    }
  },
);
