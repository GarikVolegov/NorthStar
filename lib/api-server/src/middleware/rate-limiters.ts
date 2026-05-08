/**
 * rate-limiters.ts
 *
 * Shared, Redis-backed rate limiters for the NorthStar API.
 * Uses express-rate-limit + rate-limit-redis (ioredis adapter).
 *
 * ── Redis strategy ───────────────────────────────────────────────────
 * If REDIS_URL is set, all counters are shared across every horizontal
 * instance — the only correct behaviour in a multi-pod deployment.
 * If REDIS_URL is absent (local dev / CI) the limiter silently falls
 * back to the default in-memory store: no startup crash, no config
 * change needed between environments.
 *
 * ── Key strategy ───────────────────────────────────────────────────
 * Authenticated requests are keyed by userId (req.user.id), NOT by IP.
 * This means:
 *   - A user behind a shared NAT/proxy doesn’t eat other users’ quota.
 *   - A user switching IPs doesn’t reset their quota.
 * Pre-auth routes (login) fall back to IP.
 *
 * ── Limits ───────────────────────────────────────────────────────────
 *   loginLimiter   —  10 req / 15 min   brute-force protection
 *   aiChatLimiter  —  30 req / 1 min    SSE cost guard (OpenAI)
 *   apiLimiter     — 200 req / 1 min    generic authenticated API
 *   publicLimiter  —  60 req / 1 min    unauthenticated public routes
 *   adminLimiter   — 120 req / 1 min    admin dashboard
 *
 * All limits are overridable via environment variables:
 *   RATE_LOGIN_MAX, RATE_LOGIN_WINDOW_MIN
 *   RATE_AI_MAX,    RATE_AI_WINDOW_MIN
 *   RATE_API_MAX,   RATE_API_WINDOW_MIN
 *   RATE_PUBLIC_MAX, RATE_PUBLIC_WINDOW_MIN
 *   RATE_ADMIN_MAX,  RATE_ADMIN_WINDOW_MIN
 */

import rateLimit, { type Options as RateLimitOptions } from "express-rate-limit";
import { logger } from "./loggingMiddleware";

// ── Optional Redis store ───────────────────────────────────────────────────

function buildRedisStore(windowMs: number, prefix: string) {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return undefined; // fall back to in-memory

  try {
    // Dynamic import keeps ioredis + rate-limit-redis out of the critical
    // startup path when Redis is not configured.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Redis = require("ioredis");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { RedisStore } = require("rate-limit-redis");

    const client = new Redis(redisUrl, {
      enableOfflineQueue: false,   // fail fast if Redis is down
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    client.on("error", (err: Error) => {
      logger.warn({ err }, `[RateLimit:${prefix}] Redis error — limiter degraded to in-memory`);
    });

    return new RedisStore({
      prefix:      `rl:${prefix}:`,
      windowMs,
      // sendCommand is the ioredis-compatible adapter required by rate-limit-redis v4
      sendCommand: (...args: [string, ...string[]]) => (client as any).call(...args),
    });
  } catch (err) {
    logger.warn({ err }, `[RateLimit:${prefix}] Failed to build Redis store — falling back to in-memory`);
    return undefined;
  }
}

// ── Key generator: userId → IP fallback ─────────────────────────────────

function userOrIpKey(req: any): string {
  return req.user?.id != null ? `uid:${req.user.id}` : (req.ip ?? "unknown");
}

// ── Factory ────────────────────────────────────────────────────────────────────

function makeLimiter(
  prefix: string,
  max: number,
  windowMs: number,
  overrides: Partial<RateLimitOptions> = {}
) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: "draft-7",  // RateLimit-Policy, RateLimit headers
    legacyHeaders:   false,       // disable deprecated X-RateLimit-* headers
    keyGenerator:    userOrIpKey,
    store:           buildRedisStore(windowMs, prefix),
    handler: (_req, res) => {
      res.status(429).json({
        error:   "Too many requests",
        message: "Hai superato il limite di richieste. Riprova tra poco.",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    },
    ...overrides,
  });
}

// ── Named limiters ──────────────────────────────────────────────────────────

const MIN = 60_000; // 1 minute in ms

/**
 * loginLimiter — 10 req / 15 min per IP.
 * Applied to /api/auth/* (pre-authentication, so keyed by IP).
 * Stops credential stuffing and brute-force password attacks.
 */
export const loginLimiter = makeLimiter(
  "login",
  Number(process.env.RATE_LOGIN_MAX        ?? 10),
  Number(process.env.RATE_LOGIN_WINDOW_MIN ?? 15) * MIN,
  { keyGenerator: (req) => req.ip ?? "unknown" }, // always IP for pre-auth
);

/**
 * aiChatLimiter — 30 req / 1 min per user.
 * Applied to POST /api/growth-agent/chat.
 * Guards OpenAI costs: one chat turn ≈ 1-3s of streamed tokens.
 * 30 req/min = effectively impossible to abuse in normal usage.
 */
export const aiChatLimiter = makeLimiter(
  "ai-chat",
  Number(process.env.RATE_AI_MAX        ?? 30),
  Number(process.env.RATE_AI_WINDOW_MIN ?? 1) * MIN,
);

/**
 * apiLimiter — 200 req / 1 min per user.
 * Catch-all for authenticated /api/* routes not covered by a specific limiter.
 */
export const apiLimiter = makeLimiter(
  "api",
  Number(process.env.RATE_API_MAX        ?? 200),
  Number(process.env.RATE_API_WINDOW_MIN ?? 1) * MIN,
);

/**
 * publicLimiter — 60 req / 1 min per IP.
 * Applied to unauthenticated public routes (/health, OG images).
 */
export const publicLimiter = makeLimiter(
  "public",
  Number(process.env.RATE_PUBLIC_MAX        ?? 60),
  Number(process.env.RATE_PUBLIC_WINDOW_MIN ?? 1) * MIN,
  { keyGenerator: (req) => req.ip ?? "unknown" },
);

/**
 * adminLimiter — 120 req / 1 min per user.
 * Applied to /api/admin/* routes.
 * Slightly lower than apiLimiter to protect expensive admin queries.
 */
export const adminLimiter = makeLimiter(
  "admin",
  Number(process.env.RATE_ADMIN_MAX        ?? 120),
  Number(process.env.RATE_ADMIN_WINDOW_MIN ?? 1) * MIN,
);
