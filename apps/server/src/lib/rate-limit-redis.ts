import Redis from "ioredis";
import { RedisStore } from "rate-limit-redis";
import type { Request, Response, NextFunction } from "express";
import { rootLogger } from "../middleware/logger";
import { resolveRedisUrl } from "./redis-url";

const BYPASS_RATE_LIMIT_REDIS =
  process.env.NODE_ENV === "test" || process.env.USE_MOCK_AI === "true";

let client: Redis | null = null;
let connectPromise: Promise<Redis> | null = null;

/**
 * Fail-closed HARD: se true, `requireRateLimitRedis` risponde 503 quando Redis
 * è giù. Resta gated SOLO sul flag esplicito — un blip di Redis non deve far
 * cadere l'intera API a meno che l'operatore non lo voglia esplicitamente.
 */
export function isRateLimitRedisRequired(): boolean {
  if (BYPASS_RATE_LIMIT_REDIS) return false;
  return (
    process.env.RATE_LIMIT_REDIS_REQUIRED === "true" ||
    process.env.REDIS_REQUIRED === "true"
  );
}

/**
 * Se usare lo store Redis (contatori CONDIVISI tra istanze) per il rate limit.
 * Default in produzione quando Redis è configurato: senza, ogni replica conta
 * da sola e i limiti effettivi diventano ×N inefficaci sotto scaling. In dev
 * resta in-memory (nessun Redis richiesto). Disattivabile con
 * RATE_LIMIT_REDIS_STORE=false. Lo store gira con `passOnStoreError: true`
 * (vedi middleware/rate-limit.ts) → un errore Redis fa fail-OPEN sul singolo
 * request invece di 500.
 */
export function shouldUseRedisRateLimitStore(): boolean {
  if (BYPASS_RATE_LIMIT_REDIS) return false;
  if (process.env.RATE_LIMIT_REDIS_STORE === "false") return false;
  if (isRateLimitRedisRequired()) return true;
  return process.env.NODE_ENV === "production" && resolveRedisUrl() !== null;
}

function createRateLimitClient(): Redis {
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) {
    throw new Error(
      "REDIS_URL/REDIS_PUBLIC_URL is required for fail-closed rate limiting",
    );
  }

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    maxRetriesPerRequest: 0,
  });

  redis.on("error", (err) => {
    rootLogger.error({ err }, "[rate-limit] Redis error");
  });

  return redis;
}

export async function getRateLimitRedisClient(): Promise<Redis> {
  if (BYPASS_RATE_LIMIT_REDIS) {
    throw new Error("Rate limit Redis is bypassed in test/mock mode");
  }

  if (client?.status === "ready") return client;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    const redis = client ?? createRateLimitClient();
    client = redis;
    if (redis.status !== "ready") {
      await redis.connect();
    }
    return redis;
  })().finally(() => {
    connectPromise = null;
  });

  return connectPromise;
}

export function createRedisRateLimitStore(
  prefix: string,
): RedisStore | undefined {
  if (BYPASS_RATE_LIMIT_REDIS) return undefined;
  if (!shouldUseRedisRateLimitStore()) return undefined;

  return new RedisStore({
    prefix,
    sendCommand: async (...args: string[]) => {
      const redis = await getRateLimitRedisClient();
      const [command, ...rest] = args;
      if (!command) {
        throw new Error("Missing Redis command");
      }
      return (await redis.call(command, ...rest)) as
        | boolean
        | number
        | string
        | Array<boolean | number | string>;
    },
  });
}

export async function requireRateLimitRedis(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (
    BYPASS_RATE_LIMIT_REDIS ||
    !isRateLimitRedisRequired() ||
    req.path.startsWith("/api/health")
  ) {
    next();
    return;
  }

  try {
    const redis = await getRateLimitRedisClient();
    await redis.ping();
    next();
  } catch (err) {
    rootLogger.error({ err }, "[rate-limit] Redis unavailable; failing closed");
    res.status(503).json({
      code: "RATE_LIMIT_UNAVAILABLE",
      error: "Rate limit non disponibile. Riprova tra poco.",
    });
  }
}
