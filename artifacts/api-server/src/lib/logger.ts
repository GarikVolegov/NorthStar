/**
 * Logger strutturato — NorthStar
 *
 * Architettura:
 *   - Pino come base (già installato, zero overhead)
 *   - AsyncLocalStorage per propagare il requestId senza passarlo manualmente
 *   - child() logger per ogni richiesta: tutte le righe portano requestId, userId, path
 *   - In produzione: JSON puro → pronto per Datadog / Loki / CloudWatch
 *   - In sviluppo: pino-pretty con colori
 *
 * Pattern di utilizzo nelle route:
 *
 *   import { getRequestLogger } from '../lib/logger.js';
 *
 *   router.get('/cv', authenticate, (req, res) => {
 *     const log = getRequestLogger();
 *     log.info({ cvId: 42 }, 'fetching CV');
 *     // Output JSON: { level: 'info', requestId: 'abc-123', userId: 5, path: '/api/cv', cvId: 42, msg: 'fetching CV' }
 *   });
 *
 * Pattern nei service layer (ai/, lib/):
 *
 *   import { getRequestLogger } from '../lib/logger.js';
 *   export async function processCV(data: unknown) {
 *     const log = getRequestLogger(); // stesso requestId della richiesta HTTP padre
 *     log.info('[cv] processing start');
 *   }
 *
 * Se chiamato fuori da una richiesta HTTP (scheduler, seed):
 *   getRequestLogger() ritorna il logger root — nessun errore.
 */

import pino from 'pino';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Logger } from 'pino';

// ─── Logger root ──────────────────────────────────────────────────────────────

const isProduction = process.env.NODE_ENV === 'production';

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'northstar-api',
    env: process.env.NODE_ENV ?? 'development',
  },
  // ISO timestamp invece di epoch ms — leggibile da Datadog/Loki senza trasformazioni
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: [
    'req.headers.authorization',
    'req.headers.cookie',
    "res.headers['set-cookie']",
    'body.password',
    'body.currentPassword',
    'body.newPassword',
    '*.password',
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            messageFormat: '[{requestId}] {msg}',
            ignore: 'pid,hostname,service,env',
          },
        },
      }),
});

// ─── AsyncLocalStorage — propagazione requestId senza passaggio esplicito ─────
//
// AsyncLocalStorage è il meccanismo Node.js nativo per i "thread-local" in
// ambienti async. Ogni richiesta HTTP crea un nuovo store isolato che vive
// per tutta la durata della richiesta (incluse le chiamate await downstream).
// Elimina la necessità di passare req.log o requestId come parametro
// attraverso ogni layer (route → service → ai → db).

export interface RequestContext {
  requestId: string;
  userId?:   number;
  path?:     string;
  method?:   string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

/** Avvia il contesto di una richiesta. Chiamato da requestContext middleware. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return requestContextStorage.run(context, fn) as T;
}

/**
 * Aggiorna un campo del contesto corrente.
 * Chiamato da authenticate() dopo aver verificato il JWT.
 */
export function setContextField<K extends keyof RequestContext>(
  key: K,
  value: RequestContext[K]
): void {
  const ctx = requestContextStorage.getStore();
  if (ctx) ctx[key] = value;
}

/**
 * Restituisce un child logger con il contesto della richiesta corrente.
 * Se non c'è contesto (job schedulato, seed), ritorna il logger root.
 */
export function getRequestLogger(): Logger {
  const ctx = requestContextStorage.getStore();
  if (!ctx) return logger;
  return logger.child({
    requestId: ctx.requestId,
    ...(ctx.userId !== undefined && { userId: ctx.userId }),
    ...(ctx.path   !== undefined && { path:   ctx.path   }),
    ...(ctx.method !== undefined && { method: ctx.method }),
  });
}

/** Legge il requestId corrente (usato in X-Request-Id e error handler). */
export function getRequestId(): string | undefined {
  return requestContextStorage.getStore()?.requestId;
}
