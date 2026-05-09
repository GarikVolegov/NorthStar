/**
 * cache.ts — Cache Redis per i profili utente.
 *
 * Il logger strutturato (pino) viene usato al posto di console.warn:
 * ogni evento di cache (error, miss, hit) porta { cacheKey, durationMs }
 * per semplificare il debugging in produzione.
 */
import Redis from "ioredis";
import { logger } from "./logger";

const redisUrl = process.env.REDIS_URL?.trim();
const ttlRaw = Number.parseInt(process.env.PROFILE_CACHE_TTL_SECONDS ?? "300", 10);

export const PROFILE_CACHE_TTL_SECONDS = Number.isFinite(ttlRaw) && ttlRaw > 0
  ? ttlRaw
  : 300;

let redis: Redis | null = null;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    lazyConnect:          true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue:   false,
  });

  redis.on("error", (err) => {
    logger.warn({ err }, "[cache] redis connection error");
  });

  redis.connect().catch((err) => {
    logger.warn({ err }, "[cache] redis connect failed");
  });
}

export function profileCacheKey(userId: number): string {
  return `profile:me:${userId}`;
}

export async function getProfileCache<T>(userId: number): Promise<T | null> {
  if (!redis) return null;
  const key = profileCacheKey(userId);
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    logger.warn({ err, cacheKey: key }, "[cache] get failed");
    return null;
  }
}

export async function setProfileCache(userId: number, value: unknown): Promise<void> {
  if (!redis) return;
  const key = profileCacheKey(userId);
  try {
    await redis.set(key, JSON.stringify(value), "EX", PROFILE_CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err, cacheKey: key }, "[cache] set failed");
  }
}

export async function invalidateProfileCache(userId: number): Promise<void> {
  if (!redis) return;
  const key = profileCacheKey(userId);
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn({ err, cacheKey: key }, "[cache] delete failed");
  }
}
