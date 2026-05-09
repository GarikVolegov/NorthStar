/**
 * logger.ts — Singleton pino per tutto il server NorthStar.
 *
 * USO:
 *   import { logger } from "../lib/logger";
 *
 *   // Log semplice
 *   logger.info("Server avviato");
 *
 *   // Log strutturato con campi extra
 *   logger.info({ userId: 42, action: "profile_fetch" }, "profilo caricato");
 *
 *   // Log con requestId (da req.log — vedi request-logger.ts)
 *   req.log.warn({ cacheKey: key }, "cache miss");
 *
 *   // Errore
 *   logger.error({ err }, "operazione fallita");
 *
 * LIVELLI (da LOG_LEVEL env, default: "info" in prod, "debug" in dev):
 *   trace | debug | info | warn | error | fatal
 *
 * OUTPUT:
 *   development  → pino-pretty (testo leggibile, colori)
 *   production   → JSON newline-delimited (pronto per Datadog/Loki/CloudWatch)
 *
 * SERIALIZZATORI:
 *   err  → { type, message, stack }  (standard pino)
 *   req  → { id, method, url, remoteAddress }
 *   res  → { statusCode }
 */
import pino from "pino";

const isProd = process.env.NODE_ENV === "production";

const defaultLevel = process.env.LOG_LEVEL
  ?? (isProd ? "info" : "debug");

export const logger = pino({
  level: defaultLevel,

  transport: isProd
    ? undefined
    : {
        target:  "pino-pretty",
        options: {
          colorize:        true,
          translateTime:   "SYS:HH:MM:ss.l",
          ignore:          "pid,hostname",
          messageFormat:   "{msg} {requestId}",
          singleLine:      false,
        },
      },

  serializers: {
    err:  pino.stdSerializers.err,
    req:  pino.stdSerializers.req,
    res:  pino.stdSerializers.res,
  },

  base: {
    pid:  process.pid,
    env:  process.env.NODE_ENV ?? "development",
    app:  "northstar-api",
  },

  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;

export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings) as Logger;
}
