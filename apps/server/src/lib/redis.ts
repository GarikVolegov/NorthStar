import Redis from "ioredis";
import { rootLogger } from "../middleware/logger";
import { resolveRedisUrl } from "./redis-url";

const REDIS_URL = resolveRedisUrl() ?? "";

let client: Redis | null = null;
let enabled = false;

function createClient(): Redis | null {
  if (!REDIS_URL) {
    rootLogger.warn("[redis] REDIS_URL not set — cache disabled");
    return null;
  }
  try {
    const c = new Redis(REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      retryStrategy: process.env.VERCEL
        ? () => null
        : (times) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: process.env.VERCEL ? 0 : 3,
    });

    c.on("error", (err) => {
      rootLogger.warn({ err }, "[redis] connection error");
    });

    c.on("ready", () => {
      rootLogger.info("[redis] connected");
    });

    return c;
  } catch (err) {
    rootLogger.warn({ err }, "[redis] failed to initialize — cache disabled");
    return null;
  }
}

async function init(): Promise<void> {
  if (client) return;
  client = createClient();
  if (client) {
    try {
      await client.connect();
      enabled = true;
    } catch (err) {
      rootLogger.warn({ err }, "[redis] connect failed — cache disabled");
      client = null;
    }
  }
}

const DEFAULT_TTL = 60; // seconds

export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!enabled) return null;
  if (!client) await init();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  if (!enabled) return;
  if (!client) await init();
  if (!client) return;
  try {
    const raw = JSON.stringify(value);
    if (ttl > 0) {
      await client.setex(key, ttl, raw);
    } else {
      await client.set(key, raw);
    }
  } catch {
    // silent fail — cache is best-effort
  }
}

export async function cacheDel(key: string): Promise<void> {
  if (!enabled) return;
  if (!client) await init();
  if (!client) return;
  try {
    await client.del(key);
  } catch {
    // silent fail
  }
}

export async function cacheKeys(pattern: string): Promise<string[]> {
  if (!enabled) return [];
  if (!client) await init();
  if (!client) return [];
  try {
    return await client.keys(pattern);
  } catch {
    return [];
  }
}

export async function cacheClose(): Promise<void> {
  if (!client) return;
  try {
    await client.quit();
    enabled = false;
    client = null;
  } catch {
    // silent
  }
}

/**
 * Incrementa un counter intero e imposta TTL (in secondi) solo alla prima creazione.
 * Restituisce il nuovo valore del counter, o null se Redis non disponibile.
 */
export async function cacheIncr(key: string, ttlSeconds: number): Promise<number | null> {
  if (!enabled) return null;
  if (!client) await init();
  if (!client) return null;
  try {
    const val = await client.incr(key);
    // Imposta TTL solo alla prima creazione (val === 1)
    if (val === 1) await client.expire(key, ttlSeconds);
    return val;
  } catch {
    return null;
  }
}

// Eager init on module load — won't block startup
init();
