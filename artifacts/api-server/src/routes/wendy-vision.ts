/**
 * POST /api/v1/ai/vision/analyze — Analisi immagini con VLM (streaming SSE)
 * POST /api/v1/ai/vision/generate — Generazione immagini con DALL-E
 *
 * /analyze pipeline:
 *   1. Auth + rate limit (5 req/min — VLM è costoso)
 *   2. Validazione: max 5 immagini, url https o data-URI
 *   3. [FIX CRITICAL-1] image-optimizer: resize + compress prima del VLM
 *   4. [FIX CRITICAL-2] Google: URL fetchati server-side (in vision.ts)
 *   5. Streaming SSE identico al formato wendy-chat.ts
 *
 * /generate pipeline:
 *   1. Auth + rate limit (3 req/min per DALL-E 3)
 *   2. Safety: revisedPrompt loggato per moderazione
 *   3. Risposta JSON con { images: [{ url, revisedPrompt }] }
 *
 * Formato SSE /analyze:
 *   data: {"type":"vision_start","provider":"openai","imageCount":1}\n\n
 *   data: {"choices":[{"delta":{"content":"chunk"}}]}\n\n
 *   data: [DONE]\n\n
 *
 * Usi NorthStar:
 *   - Upload CV (PDF screenshot / foto) → estrazione competenze
 *   - Analisi grafico carriera / report RIASEC printout
 *   - Wendy risponde a "Cosa dice questo documento?"
 *   - Generazione avatar professionale (DALL-E 3)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth-jwt.js';
import { rateLimit } from 'express-rate-limit';
import { logger } from '../lib/logger.js';
import { streamAnalyzeImages, generateImage } from '../lib/ai/vision.js';

export const wendyVisionRouter = Router();

// ─── Rate limiters separati per VLM vs gen ────────────────────────────────────
const analyzeRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: (req: Request) =>
    (req as Request & { user?: { id: string } }).user?.id ?? req.ip ?? 'anon',
  message: { error: 'Troppe analisi immagini. Attendi un minuto.', code: 'RATE_LIMIT' },
});

const generateRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 3,
  keyGenerator: (req: Request) =>
    (req as Request & { user?: { id: string } }).user?.id ?? req.ip ?? 'anon',
  message: { error: 'Troppa generazione di immagini. Attendi un minuto.', code: 'RATE_LIMIT' },
});

// ─── Schemi validazione ─────────────────────────────────────────────────────────

const AnalyzeBodySchema = z.object({
  images: z
    .array(
      z.string()
        .min(10)
        .max(5_000_000) // ~3.7MB base64 max
        .refine(
          (s) => s.startsWith('https://') || s.startsWith('data:image/'),
          'Ogni immagine deve essere un URL https:// o un data-URI base64 (data:image/...)'
        )
    )
    .min(1)
    .max(5),
  prompt:      z.string().min(1).max(2000),
  provider:    z.enum(['openai', 'anthropic', 'google']).default('openai'),
  detail:      z.enum(['low', 'high', 'auto']).optional(), // [v2.1] optional: ora suggerito dall'optimizer
  maxTokens:   z.number().int().min(100).max(4096).default(1024),
  temperature: z.number().min(0).max(1).default(0.2),
  history:     z
    .array(z.object({
      role:    z.enum(['user', 'assistant']),
      content: z.string().max(4000),
    }))
    .max(10)
    .default([]),
  // [FIX CRITICAL-1] intent passa al preprocessImages → image-optimizer preset
  intent: z.enum(['document', 'screenshot', 'photo']).default('screenshot'),
});

const GenerateBodySchema = z.object({
  prompt:         z.string().min(10).max(4000),
  model:          z.enum(['dall-e-3', 'dall-e-2', 'gpt-image-1']).default('dall-e-3'),
  size:           z.enum(['256x256', '512x512', '1024x1024', '1792x1024', '1024x1792'])
                    .default('1024x1024'),
  quality:        z.enum(['standard', 'hd']).default('standard'),
  style:          z.enum(['vivid', 'natural']).default('vivid'),
  responseFormat: z.enum(['url', 'b64_json']).default('url'),
});

// ─── Security: SSRF protection ─────────────────────────────────────────────────────
// Nota: questo blocco intercetta pattern letterali nell'URL.
// Per protezione completa contro SSRF via DNS rebinding, vedi lib/ai/vision.ts
// dove i fetch remoti avvengono tramite fetchImageAsDataUri().

const BLOCKED_URL_PATTERNS = [
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  /192\.168\./,
  /10\./,
  /172\.(1[6-9]|2\d|3[01])\./,
  /169\.254\./, // link-local
  /::1/,         // IPv6 loopback
  /metadata\.google/i,
  /169\.254\.169\.254/, // AWS/GCP metadata
];

function isBlockedUrl(url: string): boolean {
  return BLOCKED_URL_PATTERNS.some((re) => re.test(url));
}

// ─── Route: /vision/analyze (SSE streaming) ────────────────────────────────────────

wendyVisionRouter.post(
  '/vision/analyze',
  requireAuth,
  analyzeRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) { res.status(401).json({ error: 'Non autenticato' }); return; }

    const parsed = AnalyzeBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Body non valido', details: parsed.error.flatten() });
      return;
    }
    const { images, prompt, provider, detail, maxTokens, temperature, history, intent } = parsed.data;

    // SSRF check su pattern letterali
    for (const img of images) {
      if (img.startsWith('https://') && isBlockedUrl(img)) {
        res.status(400).json({ error: 'URL immagine non consentito', code: 'BLOCKED_URL' });
        return;
      }
    }

    res.setHeader('Content-Type',      'text/event-stream');
    res.setHeader('Cache-Control',     'no-cache');
    res.setHeader('Connection',        'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendSSE = (payload: Record<string, unknown>) =>
      res.write(`data: ${JSON.stringify(payload)}\n\n`);

    let clientDisconnected = false;
    req.on('close', () => { clientDisconnected = true; });

    sendSSE({ type: 'vision_start', provider, imageCount: images.length, intent });

    try {
      for await (const chunk of streamAnalyzeImages({
        images, prompt, provider, detail, maxTokens, temperature, history, intent,
      })) {
        if (clientDisconnected) break;
        sendSSE({ choices: [{ delta: { content: chunk } }] });
      }

      if (!clientDisconnected) res.write('data: [DONE]\n\n');
    } catch (err: unknown) {
      logger.error({ err, userId, provider, intent }, '[wendy-vision] analyze error');
      if (!clientDisconnected) {
        sendSSE({
          error: err instanceof Error ? err.message : 'VISION_ERROR',
          code:  'VISION_ERROR',
        });
        res.write('data: [DONE]\n\n');
      }
    } finally {
      res.end();
    }
  },
);

// ─── Route: /vision/generate (JSON) ────────────────────────────────────────────────

wendyVisionRouter.post(
  '/vision/generate',
  requireAuth,
  generateRateLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as Request & { user?: { id: string } }).user?.id;
    if (!userId) { res.status(401).json({ error: 'Non autenticato' }); return; }

    const parsed = GenerateBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Body non valido', details: parsed.error.flatten() });
      return;
    }

    const t0 = Date.now();
    logger.info({ userId, model: parsed.data.model }, '[wendy-vision] generate start');

    try {
      const result = await generateImage(parsed.data);

      for (const img of result.images) {
        if (img.revisedPrompt) {
          logger.info({ userId, revisedPrompt: img.revisedPrompt },
            '[wendy-vision] DALL-E revised prompt');
        }
      }

      logger.info({ userId, model: parsed.data.model, durationMs: Date.now() - t0 },
        '[wendy-vision] generate end');

      res.json({
        images:     result.images,
        model:      result.model,
        durationMs: result.durationMs,
      });
    } catch (err: unknown) {
      logger.error({ err, userId }, '[wendy-vision] generate error');
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Errore nella generazione immagine',
        code:  'IMAGE_GEN_ERROR',
      });
    }
  },
);
