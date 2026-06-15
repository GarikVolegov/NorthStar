import Redis from "ioredis";
import { rootLogger } from "../middleware/logger";
import { resolveRedisUrl } from "./redis-url";

const REDIS_URL = resolveRedisUrl() ?? "";
const DEFAULT_TTL = 60;

let client: Redis | null = null;
let enabled = false;
let initAttempted = false;

function createClient(): Redis | null {
  if (!REDIS_URL) {
    rootLogger.warn("[redis] REDIS_URL not set - cache disabled");
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
    rootLogger.warn({ err }, "[redis] failed to initialize - cache disabled");
    return null;
  }
}

async function init(): Promise<void> {
  if (client) return;
  client = createClient();
  if (!client) return;

  try {
    await client.connect();
    enabled = true;
  } catch (err) {
    rootLogger.warn({ err }, "[redis] connect failed - cache disabled");
    enabled = false;
    client = null;
  }
}

async function getClient(): Promise<Redis | null> {
  if (enabled && client) return client;
  if (initAttempted) return null;
  initAttempted = true;
  await init();
  return enabled ? client : null;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const activeClient = await getClient();
  if (!activeClient) return null;

  try {
    const raw = await activeClient.get(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttl = DEFAULT_TTL): Promise<void> {
  const activeClient = await getClient();
  if (!activeClient) return;

  try {
    const raw = JSON.stringify(value);
    if (ttl > 0) {
      await activeClient.setex(key, ttl, raw);
    } else {
      await activeClient.set(key, raw);
    }
  } catch {
    // Cache is best-effort.
  }
}

/**
 * Get-or-compute con cache Redis. Se la chiave è in cache la restituisce,
 * altrimenti esegue `compute`, ne salva il risultato (TTL in secondi) e lo
 * ritorna. Best-effort: se Redis è giù, esegue sempre `compute` (nessun
 * fallimento). Usare SOLO per dati non-utente/aggregati che tollerano una
 * staleness pari al TTL. Nota: un risultato `null`/`undefined` non viene
 * cachato (cacheGet→null è indistinguibile da un miss).
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const value = await compute();
  if (value !== null && value !== undefined) {
    await cacheSet(key, value, ttlSeconds);
  }
  return value;
}

export async function cacheDel(key: string): Promise<void> {
  const activeClient = await getClient();
  if (!activeClient) return;

  try {
    await activeClient.del(key);
  } catch {
    // Cache is best-effort.
  }
}

export async function cacheKeys(pattern: string): Promise<string[]> {
  const activeClient = await getClient();
  if (!activeClient) return [];

  try {
    return await activeClient.keys(pattern);
  } catch {
    return [];
  }
}

export async function cacheClose(): Promise<void> {
  if (!client) return;

  try {
    await client.quit();
  } catch {
    // Cache is best-effort.
  } finally {
    enabled = false;
    client = null;
    initAttempted = false;
  }
}

export async function cacheIncr(key: string, ttlSeconds: number): Promise<number | null> {
  const activeClient = await getClient();
  if (!activeClient) return null;

  try {
    const val = await activeClient.incr(key);
    if (val === 1) await activeClient.expire(key, ttlSeconds);
    return val;
  } catch {
    return null;
  }
}
