/**
 * Middleware requestContext — NorthStar
 *
 * Responsabilità:
 *   1. Genera o accetta un requestId (UUID v4 o X-Request-Id da upstream)
 *   2. Inizializza AsyncLocalStorage con il contesto della richiesta
 *   3. Aggiunge X-Request-Id alla risposta — il frontend e il supporto possono usarlo
 *   4. Scrive log "request start" e "request end" con durationMs e statusCode
 *
 * DEVE essere registrato PRIMA di pinoHttp e di qualsiasi route in app.ts.
 *
 * Formato requestId:
 *   - Se presente X-Request-Id nel header (Nginx, API Gateway, frontend): usato as-is (max 64 char)
 *   - Altrimenti: UUID v4 generato lato server
 *
 * Esempio log:
 *   { level: 'info', requestId: 'a1b2-...', method: 'POST', path: '/api/cv', msg: 'request start' }
 *   { level: 'info', requestId: 'a1b2-...', statusCode: 201, durationMs: 143, msg: 'request end' }
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { runWithContext, getRequestLogger, setContextField, type RequestContext } from './logger.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestContext(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const incomingId = req.headers['x-request-id'];
  const requestId = typeof incomingId === 'string' && incomingId.length > 0
    ? incomingId.slice(0, 64)
    : randomUUID();

  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const context: RequestContext = {
    requestId,
    path:   req.path,
    method: req.method,
  };

  runWithContext(context, () => {
    const log = getRequestLogger();
    const t0 = Date.now();

    log.info({ msg: 'request start' });

    res.on('finish', () => {
      const durationMs = Date.now() - t0;
      const level = res.statusCode >= 500 ? 'error'
                  : res.statusCode >= 400 ? 'warn'
                  : 'info';
      log[level]({ statusCode: res.statusCode, durationMs, msg: 'request end' });
    });

    next();
  });
}

/**
 * Middleware opzionale da applicare dopo authenticate() nelle route protette.
 * Arricchisce il contesto con lo userId una volta che il JWT è stato verificato.
 *
 * Alternativa: chiamare setContextField('userId', user.id) direttamente dentro authenticate().
 */
export function enrichContextWithUser(
  req: Request & { user?: { id: number } },
  _res: Response,
  next: NextFunction
): void {
  if (req.user?.id !== undefined) {
    setContextField('userId', req.user.id);
  }
  next();
}
