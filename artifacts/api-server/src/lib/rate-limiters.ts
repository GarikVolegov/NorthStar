/**
 * Rate limiters per NorthStar API
 *
 * Strategia a 2 livelli:
 *   1. globalRateLimiter  — 200 req/min per IP (già in app.ts)
 *   2. Limiter specifici  — finestre più strette per route sensibili
 *
 * Tutti usano express-rate-limit con store in-memory.
 * In produzione multi-istanza: sostituire con RedisStore.
 *
 * Import: import { authLimiter, adminLimiter, aiLimiter, uploadLimiter } from '../lib/rate-limiters';
 */
import rateLimit, { type Options } from 'express-rate-limit';
import { logger } from './logger.js';

// ─── Helper: crea limiter con logging ────────────────────────────────────────
function createLimiter(name: string, options: Partial<Options>) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,   // default: 15 minuti
    max: 100,                    // default: 100 req/finestra
    standardHeaders: 'draft-7', // RateLimit-Policy, RateLimit headers (RFC 9110)
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    keyGenerator: (req) => {
      // Usa l'IP reale (app.set('trust proxy', 1) già in app.ts)
      return req.ip ?? req.socket.remoteAddress ?? 'unknown';
    },
    handler: (req, res) => {
      logger.warn(
        { ip: req.ip, route: req.path, limiter: name },
        `Rate limit superato: ${name}`,
      );
      res.status(429).json({
        error: 'TOO_MANY_REQUESTS',
        message: 'Troppe richieste. Riprova tra qualche minuto.',
        retryAfter: res.getHeader('RateLimit-Reset'),
      });
    },
    ...options,
  });
}

// ─── 1. Auth limiter — login + register ──────────────────────────────────────
// 10 tentativi per 15 min per IP — mitiga brute force sulle password
export const authLimiter = createLimiter('auth', {
  windowMs: 15 * 60 * 1000,  // 15 minuti
  max: 10,
  message: 'Troppi tentativi di accesso. Riprova tra 15 minuti.',
  skipSuccessfulRequests: true,  // non conta le login riuscite
});

// ─── 2. Admin limiter — route /api/admin/* ────────────────────────────────────
// 60 req/min — abbastanza per uso normale, blocca scraping automatico
export const adminLimiter = createLimiter('admin', {
  windowMs: 60 * 1000,   // 1 minuto
  max: 60,
});

// ─── 3. AI limiter — route che chiamano LLM ──────────────────────────────────
// 20 req/min per IP — ogni call AI ha costo computazionale + economico
// Gli utenti premium potrebbero avere un limite più alto (vedi nota sotto)
export const aiLimiter = createLimiter('ai', {
  windowMs: 60 * 1000,   // 1 minuto
  max: 20,
  // Nota: per premium bypassare il limiter con skipIf:
  // skip: (req) => req.user?.isPremium === true,
});

// ─── 4. Upload limiter — route /api/cv/*/upload ──────────────────────────────
// 5 upload ogni 10 min per IP — previene DoS tramite file upload ripetuti
export const uploadLimiter = createLimiter('upload', {
  windowMs: 10 * 60 * 1000,  // 10 minuti
  max: 5,
});

// ─── 5. Password reset limiter — /api/auth/reset-password ───────────────────
// 3 richieste ogni 30 min — previene email bombing e account enumeration
export const passwordResetLimiter = createLimiter('password-reset', {
  windowMs: 30 * 60 * 1000,  // 30 minuti
  max: 3,
});

// ─── Tabella riepilogativa (documentazione) ──────────────────────────────────
// | Limiter              | Finestra | Max req | Route                             |
// |----------------------|----------|---------|-----------------------------------|
// | global               | 1 min    | 200     | /*  (tutte)                       |
// | authLimiter          | 15 min   | 10      | POST /auth/login, /auth/register  |
// | adminLimiter         | 1 min    | 60      | /api/admin/*                      |
// | aiLimiter            | 1 min    | 20      | /cv/generate, /cv/tailor, /chat   |
// | uploadLimiter        | 10 min   | 5       | /cv/*/upload                      |
// | passwordResetLimiter | 30 min   | 3       | /auth/reset-password              |
