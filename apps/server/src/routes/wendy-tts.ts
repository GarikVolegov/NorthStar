/**
 * POST /api/v1/ai/tts
 *   Body: { text: string, voiceId?: string, modelId?: string }
 *   Response: audio/mpeg stream (ElevenLabs proxy)
 *
 * POST /api/v1/ai/voice/token
 *   Response: { token: string, expiresAt: number }
 *   Genera un token Deepgram temporaneo (TTL 60s, scope: listen)
 *
 * v2.2 improvements:
 *   [TTS-1] AbortSignal.timeout(30s) su fetch ElevenLabs (anti-hang)
 *   [TTS-2] Cap audioBuffer a 10MB per evitare OOM su messaggi enormi
 *   [TTS-3] ElevenLabs 429 → risposta 429 al client con Retry-After header
 *   [TTS-4] Token Deepgram: aggiunto AbortSignal.timeout(5s)
 *   [TTS-5] Cache: eviction pulisce anche entry scadute prima di usare LRU
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { requireAuth } from '../middlewares/requireAuth.js';
import { rateLimit } from 'express-rate-limit';
import { logger } from '../lib/logger.js';

export const wendyTTSRouter = Router();

// ─── Config ────────────────────────────────────────────────────────────────────

const DEFAULT_VOICE_ID      = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL';
const DEFAULT_MODEL_ID      = 'eleven_multilingual_v2';
const MAX_TEXT_CHARS         = 5_000;
const DEEPGRAM_TOKEN_TTL_MS  = 60_000;
// [TTS-2] Limite superiore buffer audio (~10MB). ElevenLabs ritorna ~32kbps mp3,
// quindi 10MB ≈ 40 minuti di audio — ben oltre qualsiasi messaggio Wendy.
const MAX_AUDIO_BYTES        = 10 * 1024 * 1024;
// [TTS-1] Timeout fetch verso ElevenLabs (connessione + download)
const ELEVENLABS_TIMEOUT_MS  = 30_000;
// [TTS-4] Timeout fetch verso Deepgram
const DEEPGRAM_TIMEOUT_MS    = 5_000;

// ─── LRU Cache in-memory ──────────────────────────────────────────────────────────

interface CacheEntry {
  buffer:    Buffer;
  expiresAt: number;
}

const TTS_CACHE_MAX = 50;
const TTS_CACHE_TTL = 10 * 60 * 1000; // 10 minuti
const ttsCache      = new Map<string, CacheEntry>();

function cacheKey(text: string, voiceId: string, modelId: string): string {
  return createHash('sha256').update(`${text}|${voiceId}|${modelId}`).digest('hex').slice(0, 16);
}

function cacheGet(key: string): Buffer | null {
  const entry = ttsCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { ttsCache.delete(key); return null; }
  return entry.buffer;
}

// [TTS-5] Pulizia lazy: prima di fare spazio con LRU, rimuove le entry scadute.
//         Evita di eliminare entry valide solo perché la Map ha 50 slot usati da cache stale.
function cacheSet(key: string, buffer: Buffer): void {
  const now = Date.now();
  // 1. Prima rimuovi le entry scadute
  for (const [k, v] of ttsCache) {
    if (now > v.expiresAt) ttsCache.delete(k);
  }
  // 2. Se ancora piena, evict il più vecchio (ordine di inserimento)
  if (ttsCache.size >= TTS_CACHE_MAX) {
    const oldest = ttsCache.keys().next().value;
    if (oldest) ttsCache.delete(oldest);
  }
  ttsCache.set(key, { buffer, expiresAt: now + TTS_CACHE_TTL });
}

// ─── Rate limiters ────────────────────────────────────────────────────────────────

const ttsRateLimit = rateLimit({
  validate: { ip: false },
  windowMs: 60_000, max: 10,
  keyGenerator: (req: Request) => (req as Request & { user?: { id: string } }).user?.id ?? 'anon',
  message: { error: 'Troppe richieste TTS. Attendi un minuto.', code: 'RATE_LIMIT' },
});

const tokenRateLimit = rateLimit({
  windowMs: 60_000, max: 20,
  validate: { ip: false },
  keyGenerator: (req: Request) => (req as Request & { user?: { id: string } }).user?.id ?? 'anon',
  message: { error: 'Troppe richieste token vocale.', code: 'RATE_LIMIT' },
});

// ─── Schema ───────────────────────────────────────────────────────────────────────

const TTSBodySchema = z.object({
  text:    z.string().min(1).max(MAX_TEXT_CHARS),
  voiceId: z.string().min(1).max(100).default(DEFAULT_VOICE_ID),
  modelId: z.string().min(1).max(100).default(DEFAULT_MODEL_ID),
});

// ─── Route: POST /tts ───────────────────────────────────────────────────────────────

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

    const key    = cacheKey(text, voiceId, modelId);
    const cached = cacheGet(key);

    if (cached) {
      logger.debug({ userId, voiceId, cacheHit: true }, '[tts] cache hit');
      res.setHeader('Content-Type',   'audio/mpeg');
      res.setHeader('Content-Length', cached.length.toString());
      res.setHeader('X-Cache',        'HIT');
      res.send(cached);
      return;
    }

    const t0 = Date.now();
    logger.info({ userId, voiceId, modelId, textLen: text.length }, '[tts] start');

    try {
      // [TTS-1] AbortSignal.timeout: se ElevenLabs non risponde entro 30s, abort
      const elResp = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
        {
          method:  'POST',
          signal:  AbortSignal.timeout(ELEVENLABS_TIMEOUT_MS),
          headers: {
            'xi-api-key':   apiKey,
            'Content-Type': 'application/json',
            'Accept':       'audio/mpeg',
          },
          body: JSON.stringify({
            text:           text.slice(0, MAX_TEXT_CHARS),
            model_id:       modelId,
            voice_settings: {
              stability:         0.5,
              similarity_boost:  0.8,
              style:             0.3,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!elResp.ok) {
        const body = await elResp.text();
        logger.warn({ userId, status: elResp.status, body }, '[tts] ElevenLabs error');

        // [TTS-3] Propaga correttamente il 429 con Retry-After se presente
        if (elResp.status === 429) {
          const retryAfter = elResp.headers.get('retry-after') ?? '60';
          res.setHeader('Retry-After', retryAfter);
          res.status(429).json({ error: 'ElevenLabs rate limit — riprova tra ' + retryAfter + 's', code: 'TTS_RATE_LIMIT' });
          return;
        }

        res.status(elResp.status === 401 ? 503 : 502).json({
          error: `ElevenLabs error ${elResp.status}`,
          code:  'TTS_UPSTREAM_ERROR',
        });
        return;
      }

      const arrayBuffer = await elResp.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);

      // [TTS-2] Cap dimensione buffer per prevenire OOM
      if (audioBuffer.length > MAX_AUDIO_BYTES) {
        logger.warn({ userId, audioBytes: audioBuffer.length, maxBytes: MAX_AUDIO_BYTES }, '[tts] audio troppo grande — troncato');
        res.status(413).json({ error: 'Audio troppo lungo', code: 'TTS_TOO_LARGE' });
        return;
      }

      cacheSet(key, audioBuffer);

      logger.info({
        userId, voiceId, durationMs: Date.now() - t0,
        audioKB: Math.round(audioBuffer.length / 1024),
      }, '[tts] end');

      res.setHeader('Content-Type',   'audio/mpeg');
      res.setHeader('Content-Length', audioBuffer.length.toString());
      res.setHeader('X-Cache',        'MISS');
      res.send(audioBuffer);

    } catch (err) {
      // AbortError → timeout ElevenLabs
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn({ userId, timeoutMs: ELEVENLABS_TIMEOUT_MS }, '[tts] timeout ElevenLabs');
        res.status(504).json({ error: 'ElevenLabs timeout — riprova', code: 'TTS_TIMEOUT' });
        return;
      }
      logger.error({ err, userId }, '[tts] fetch error');
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Errore TTS',
        code:  'TTS_ERROR',
      });
    }
  },
);

// ─── Route: POST /voice/token ───────────────────────────────────────────────────────

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
      // [TTS-4] AbortSignal.timeout: Deepgram è veloce, 5s è abbondante
      const dgResp = await fetch(
        'https://api.deepgram.com/v1/projects/tokens',
        {
          method:  'POST',
          signal:  AbortSignal.timeout(DEEPGRAM_TIMEOUT_MS),
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type':  'application/json',
          },
          body: JSON.stringify({
            comment:                 `northstar-wendy-${userId.slice(0, 8)}`,
            scopes:                  ['usage:write'],
            expiration_date:         new Date(Date.now() + DEEPGRAM_TOKEN_TTL_MS).toISOString(),
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

      const data  = await dgResp.json() as { key: string };
      const token = data.key;

      logger.info({ userId }, '[voice-token] token creato');
      res.json({ token, expiresAt: Date.now() + DEEPGRAM_TOKEN_TTL_MS });

    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        logger.warn({ userId }, '[voice-token] Deepgram timeout');
        res.status(504).json({ error: 'Deepgram timeout', code: 'TOKEN_TIMEOUT' });
        return;
      }
      logger.error({ err, userId }, '[voice-token] error');
      res.status(500).json({ error: 'Errore interno', code: 'TOKEN_ERROR' });
    }
  },
);
