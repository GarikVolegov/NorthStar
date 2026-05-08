/**
 * Global error handler — NorthStar
 *
 * Cattura tutti gli errori non gestiti dalle route e li loga con requestId
 * prima di rispondere al client con un formato JSON consistente.
 *
 * Registrare in app.ts DOPO tutte le route:
 *   import { errorHandler } from './lib/middlewares/error-handler.js';
 *   app.use(errorHandler);
 *
 * Formato risposta errore (produzione):
 *   { error: 'Internal Server Error', requestId: 'abc-123' }
 *
 * Formato risposta errore (sviluppo):
 *   { error: 'Internal Server Error', requestId: 'abc-123', _dev: { message, stack } }
 *
 * Il requestId nel body permette al cliente di aprire un ticket con un ID
 * che il team può cercare direttamente su Datadog/Loki.
 */

import type { Request, Response, NextFunction } from 'express';
import { getRequestLogger, getRequestId } from '../logger.js';

const isDev = process.env.NODE_ENV !== 'production';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const log = getRequestLogger();
  const requestId = getRequestId();

  const message = err instanceof Error ? err.message : String(err);
  const stack   = err instanceof Error ? err.stack   : undefined;
  const status =
    (err as { status?: number })?.status ??
    (err as { statusCode?: number })?.statusCode ??
    500;

  if (status >= 500) {
    log.error({ err, status }, `unhandled error: ${message}`);
  } else {
    log.warn({ err, status }, `client error: ${message}`);
  }

  res.status(status).json({
    error: status >= 500 ? 'Internal Server Error' : message,
    requestId,
    ...(isDev && status >= 500 && { _dev: { message, stack } }),
  });
}
