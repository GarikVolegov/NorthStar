import rateLimit, { type Options } from "express-rate-limit";
import type { Request } from "express";

let redisStoreInitialized = false;
let redisStore: any = null;

async function initRedisStore(): Promise<void> {
  if (redisStoreInitialized) return;
  redisStoreInitialized = true;
  try {
    const mod: any = await import("rate-limit-redis");
    const RedisStore = mod.default ?? mod;
    const Redis = (await import("ioredis")).default;
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const client = new Redis(redisUrl, {
        enableOfflineQueue: false,
        maxRetriesPerRequest: 0,
      });
      redisStore = new RedisStore({ client });
    }
  } catch {
    // Redis not available — falling back to memory store
  }
}

function buildOptions(overrides: Partial<Options>): Partial<Options> {
  const base: Partial<Options> = {
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Troppe richieste. Riprova tra poco." },
  };
  if (redisStore) base.store = redisStore;
  return { ...base, ...overrides };
}

export const globalLimiter = rateLimit(
  buildOptions({ windowMs: 60 * 1000, max: 100 })
);

export const wendyLimiter = rateLimit(
  buildOptions({
    windowMs: 60 * 1000,
    max: 30,
    skip: (req: Request) =>
      process.env.NODE_ENV === "test" || process.env.USE_MOCK_AI === "true",
  })
);

export const authLimiter = rateLimit(
  buildOptions({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { error: "Troppi tentativi di login. Riprova tra 15 minuti." },
  })
);

export const adminLimiter = rateLimit(
  buildOptions({ windowMs: 60 * 1000, max: 200 })
);

// Kick off Redis init eagerly but don't block startup
initRedisStore();
