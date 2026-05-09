import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL?.trim();
const ttlRaw = Number.parseInt(process.env.PROFILE_CACHE_TTL_SECONDS ?? "300", 10);

export const PROFILE_CACHE_TTL_SECONDS = Number.isFinite(ttlRaw) && ttlRaw > 0
  ? ttlRaw
  : 300;

let redis: Redis | null = null;

if (redisUrl) {
  redis = new Redis(redisUrl, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  redis.on("error", (err) => {
    console.warn("[cache] redis error:", err.message);
  });

  redis.connect().catch((err) => {
    console.warn("[cache] redis connect failed:", err.message);
  });
}

export function profileCacheKey(userId: number): string {
  return `profile:me:${userId}`;
}

export async function getProfileCache<T>(userId: number): Promise<T | null> {
  if (!redis) return null;

  try {
    const raw = await redis.get(profileCacheKey(userId));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn("[cache] get failed:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function setProfileCache(userId: number, value: unknown): Promise<void> {
  if (!redis) return;

  try {
    await redis.set(profileCacheKey(userId), JSON.stringify(value), "EX", PROFILE_CACHE_TTL_SECONDS);
  } catch (err) {
    console.warn("[cache] set failed:", err instanceof Error ? err.message : String(err));
  }
}

export async function invalidateProfileCache(userId: number): Promise<void> {
  if (!redis) return;

  try {
    await redis.del(profileCacheKey(userId));
  } catch (err) {
    console.warn("[cache] delete failed:", err instanceof Error ? err.message : String(err));
  }
}
