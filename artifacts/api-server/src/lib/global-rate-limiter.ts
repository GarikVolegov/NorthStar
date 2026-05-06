/**
 * Global rate limiting middleware.
 * Apply this in app.ts AFTER securityHeaders and BEFORE routes.
 *
 * Strategy:
 *   - All endpoints: 200 req/min per IP (prevents basic DoS)
 *   - Auth endpoints: already have their own tighter limiters (5/min)
 *   - AI endpoints: handled by aiChatRateLimiter / aiGenerationRateLimiter per user
 */
import { rateLimit } from "express-rate-limit";

/**
 * Global limiter — applied to all /api/* routes.
 * Generous enough for normal use, blocks script-level abuse.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 60_000, // 1 minute
  max: 200,         // 200 req/min per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Troppe richieste. Riprova tra qualche secondo." },
  skip: (req) => {
    // Never limit health check — used by Docker/load balancers
    return req.path === "/api/health";
  },
});

/**
 * Stricter limiter for unauthenticated public endpoints.
 * Apply directly on sensitive routes like /api/auth/login.
 */
export const strictPublicLimiter = rateLimit({
  windowMs: 15 * 60_000, // 15 minutes
  max: 30,               // 30 req per 15 min per IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Troppi tentativi. Riprova tra 15 minuti." },
});
