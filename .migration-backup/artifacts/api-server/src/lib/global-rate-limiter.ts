/**
 * Rate limiting distribuito — NorthStar
 *
 * Strategia:
 *   - Se REDIS_URL è presente (staging, produzione): RedisStore condiviso tra istanze
 *   - Se REDIS_URL è assente (sviluppo locale, CI): fallback silenzioso a MemoryStore
 *
 * Perché Redis per il rate limiting:
 *   Con un singolo processo Node.js, lo store in-memory funziona correttamente.
 *   Con più istanze orizzontali (Kubernetes, Docker Swarm, serverless), ogni istanza
 *   mantiene un contatore indipendente. Un attaccante che manda 200 req/min a 3 istanze
 *   raggiunge effettivamente 600 req/min. Redis centralizza il contatore.
 *
 * Limiter disponibili:
 *   - globalRateLimiter:    200 req/min per IP  — tutte le route
 *   - strictPublicLimiter:   30 req/15min per IP — auth, login, signup
 *   - aiChatLimiter:         40 req/min per userId — endpoint /api/ai/chat
 *   - aiGenerationLimiter:   10 req/min per userId — endpoint /api/ai/generate (costosi)
 *
 * Configurazione:
 *   REDIS_URL=redis://localhost:6379          (dev locale con Redis)
 *   REDIS_URL=rediss://user:pass@host:6380    (produzione TLS)
 *
 * Key prefix Redis: "rl:{limiterName}:" — evita collisioni con altre chiavi Redis.
 */

import { rateLimit, ipKeyGenerator, type Store, type Options } from 'express-rate-limit';
import type { Request } from 'express';
import { getRequestLogger } from './logger.js';

// ─── Redis Store (caricato dinamicamente per non crashare se Redis non è disponibile) ───

type RedisStoreConstructor = new (opts: Record<string, unknown>) => Store;

/**
 * Tenta di costruire un RedisStore con ioredis.
 * Ritorna null se:
 *   - REDIS_URL non è impostata
 *   - rate-limit-redis / ioredis non sono installati
 *   - La connessione iniziale fallisce
 *
 * In tutti i casi il caller usa il MemoryStore di default.
 */
async function buildRedisStore(
  prefix: string
): Promise<Store | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  try {
    const [{ RedisStore }, { default: Redis }] = await Promise.all([
      import('rate-limit-redis'),
      import('ioredis'),
    ]);

    const client = new Redis(redisUrl, {
      // Timeout aggressivo: preferiamo degradare a in-memory piuttosto che
      // bloccare le richieste se Redis è irraggiungibile.
      connectTimeout: 3_000,
      commandTimeout: 1_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });

    await client.connect();

    client.on('error', (err: Error) => {
      // Log ma non crash — express-rate-limit degrada a MemoryStore automaticamente
      // se il sendCommand fallisce.
      const log = getRequestLogger();
      log.error({ err, prefix }, '[rate-limit] Redis error');
    });

    const store = new (RedisStore as unknown as RedisStoreConstructor)({
      // sendCommand è l'interfaccia richiesta da rate-limit-redis v4+
      sendCommand: (...args: string[]) => (client as unknown as { call: (...a: string[]) => Promise<unknown> }).call(...args),
      prefix: `rl:${prefix}:`,
    });

    getRequestLogger().info({ prefix, redisUrl: redisUrl.replace(/:[^:@]+@/, ':***@') }, '[rate-limit] Redis store attivo');
    return store;
  } catch (err) {
    const log = getRequestLogger();
    log.warn({ err, prefix }, '[rate-limit] Fallback a MemoryStore (Redis non disponibile)');
    return null;
  }
}

// ─── Factory limiter ────────────────────────────────────────────────────────────────

async function createLimiter(
  prefix: string,
  opts: Omit<Options, 'store'>
) {
  const store = await buildRedisStore(prefix);
  return rateLimit({
    ...opts,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // store: undefined usa il MemoryStore interno di express-rate-limit
    ...(store ? { store } : {}),
  });
}

// ─── Limiter exports (inizializzati in modo asincrono) ────────────────────────────
//
// Express-rate-limit accetta un middleware asincrono direttamente tramite
// il pattern "lazy init": il limiter viene creato alla prima richiesta
// e poi riutilizzato. Usiamo una Promise cached per garantire
// che buildRedisStore() venga chiamato una sola volta per limiter.

type RateLimitMiddleware = ReturnType<typeof rateLimit>;

function lazyLimiter(
  prefix: string,
  opts: Omit<Options, 'store'>
): RateLimitMiddleware {
  let middlewarePromise: Promise<RateLimitMiddleware> | null = null;
  let resolved: RateLimitMiddleware | null = null;

  // Il middleware wrapping è sincrono per Express, ma delega internamente all'async.
  const wrapper: RateLimitMiddleware = (req, res, next) => {
    if (resolved) {
      resolved(req, res, next);
      return;
    }
    if (!middlewarePromise) {
      middlewarePromise = createLimiter(prefix, opts).then((m) => {
        resolved = m;
        return m;
      });
    }
    middlewarePromise.then((m) => m(req, res, next)).catch(next);
  };

  return wrapper;
}

// ─── Limiter pubblici ───────────────────────────────────────────────────────────────

/**
 * Global limiter — tutte le route /api/*
 * 200 req/min per IP. Previene DoS di base.
 */
export const globalRateLimiter = lazyLimiter('global', {
  windowMs: 60_000,
  max: 200,
  message: { error: 'Troppe richieste. Riprova tra qualche secondo.' },
  skip: (req: Request) => req.path === '/api/health',
});

/**
 * Strict limiter — endpoint pubblici sensibili (login, signup, forgot-password)
 * 30 req per 15 min per IP.
 */
export const strictPublicLimiter = lazyLimiter('strict_public', {
  windowMs: 15 * 60_000,
  max: 30,
  message: { error: 'Troppi tentativi. Riprova tra 15 minuti.' },
});

/**
 * AI chat limiter — /api/ai/chat e route simili
 * 40 req/min per userId (dopo autenticazione).
 * Usa userId come chiave per non penalizzare IP condivisi (NAT, uffici).
 */
export const aiChatLimiter = lazyLimiter('ai_chat', {
  windowMs: 60_000,
  max: 40,
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { id: number } }).user;
    return user?.id ? `user:${user.id}` : ipKeyGenerator(req);
  },
  message: { error: 'Limite AI raggiunto. Riprova tra un minuto.' },
});

/**
 * AI generation limiter — endpoint costosi (CV tailoring, roadmap AI, embed)
 * 10 req/min per userId. Più stretto perché ogni chiamata consuma token significativi.
 */
export const aiGenerationLimiter = lazyLimiter('ai_generation', {
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req: Request) => {
    const user = (req as Request & { user?: { id: number } }).user;
    return user?.id ? `user:${user.id}` : ipKeyGenerator(req);
  },
  message: { error: 'Limite generazione AI raggiunto. Riprova tra un minuto.' },
});
