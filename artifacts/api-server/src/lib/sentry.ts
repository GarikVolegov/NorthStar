/**
 * sentry.ts — Error tracking & performance monitoring.
 *
 * ⚠️  REGOLA 0: vedi AI_RULES.md + API_RULES.md prima di modificare.
 *
 * Strategia:
 *   - SENTRY_DSN non impostato (locale/test) → tutti i metodi sono no-op.
 *   - SENTRY_DSN impostato (staging/prod)    → SDK attivo.
 *   - Non inviamo mai email, password o CV text a Sentry.
 *     Solo: userId (numero), requestId (UUID), path, method, eventType.
 *
 * Setup:
 *   1. pnpm add @sentry/node @sentry/profiling-node
 *   2. Aggiungi SENTRY_DSN al .env e alle variabili CI/CD
 *   3. Aggiungi SENTRY_RELEASE nel workflow (es. git SHA): SENTRY_RELEASE=$(git rev-parse --short HEAD)
 *
 * Uso:
 *   import { captureError, addBreadcrumb } from './sentry.js';
 *   captureError(err, { userId, requestId, path: req.path });
 *   addBreadcrumb('affiliate', 'invoice.paid', { userId });
 */

type SentryContext = {
  userId?:    number | null;
  requestId?: string;
  path?:      string;
  method?:    string;
  eventType?: string;
  extra?:     Record<string, unknown>;
};

let Sentry: typeof import('@sentry/node') | null = null;

/**
 * Inizializza Sentry. Chiamare UNA VOLTA al bootstrap dell'app, prima di
 * qualsiasi middleware Express. Se SENTRY_DSN non è impostato, è un no-op.
 */
export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[Sentry] SENTRY_DSN non impostato — error tracking disabilitato.');
    return;
  }

  try {
    Sentry = await import('@sentry/node');
    const isProd = process.env.NODE_ENV === 'production';

    Sentry.init({
      dsn,
      release: process.env.SENTRY_RELEASE ?? 'unknown',
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: isProd ? 0.1 : 1.0,
      // Non inviare PII automatici (body, headers con token, ecc.)
      sendDefaultPii: false,
      integrations: [],
      beforeSend(event) {
        // Rimuovi eventuali dati sensibili che potrebbero essere stati
        // inclusi automaticamente da Sentry SDK
        if (event.request) {
          delete event.request.cookies;
          delete event.request.data;
          if (event.request.headers) {
            delete (event.request.headers as Record<string, unknown>)['authorization'];
            delete (event.request.headers as Record<string, unknown>)['cookie'];
          }
        }
        return event;
      },
    });

    console.log(`[Sentry] Inizializzato — env=${process.env.NODE_ENV} release=${process.env.SENTRY_RELEASE ?? 'unknown'}`);
  } catch (err) {
    // Non bloccare il boot dell'app se Sentry fallisce
    console.error('[Sentry] Inizializzazione fallita:', err);
    Sentry = null;
  }
}

/**
 * Cattura un errore e lo invia a Sentry con contesto extra.
 * No-op se Sentry non è inizializzato.
 */
export function captureError(
  err: unknown,
  ctx?: SentryContext,
): void {
  if (!Sentry) {
    // In locale logga come console.error normale
    console.error('[captureError]', err, ctx);
    return;
  }

  Sentry.withScope((scope) => {
    if (ctx?.userId != null)  scope.setUser({ id: String(ctx.userId) });
    if (ctx?.requestId)       scope.setTag('requestId', ctx.requestId);
    if (ctx?.path)            scope.setTag('path', ctx.path);
    if (ctx?.method)          scope.setTag('method', ctx.method);
    if (ctx?.eventType)       scope.setTag('eventType', ctx.eventType);
    if (ctx?.extra)           scope.setExtras(ctx.extra);

    Sentry!.captureException(err);
  });
}

/**
 * Aggiunge un breadcrumb al trace Sentry corrente.
 * Utile per tracciare il flusso affiliate step-by-step.
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>,
): void {
  if (!Sentry) return;
  Sentry.addBreadcrumb({ category, message, data, level: 'info' });
}

/**
 * Restituisce il Sentry error handler middleware Express.
 * DEVE essere montato DOPO tutte le route, PRIMA del catch-all 404/500.
 * Se Sentry non è inizializzato, restituisce un no-op middleware.
 */
export function getSentryErrorHandler(): (
  err: unknown,
  req: import('express').Request,
  res: import('express').Response,
  next: import('express').NextFunction,
) => void {
  if (!Sentry) {
    return (err, _req, _res, next) => next(err);
  }
  return Sentry.expressErrorHandler() as any;
}
