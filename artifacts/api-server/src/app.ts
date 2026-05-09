/**
 * app.ts — Express application factory.
 *
 * ⚠️  REGOLA 0:
 *   UI/componenti  → FRONTEND_RULES.md
 *   API/route      → API_RULES.md
 *   DB/migrations  → DB_RULES.md
 *   AI/agent       → AI_RULES.md
 *   Git/commit     → GIT_RULES.md
 *
 * Ordine middleware (l'ordine è fondamentale):
 *   0. Sentry.init()          — DEVE stare prima di tutto
 *   1. Security headers
 *   2. Request context + requestId
 *   3. Pino HTTP logging
 *   4. Webhook Stripe (express.raw PRIMA di express.json)
 *   5. CORS + Body parsing (express.json)
 *   6. Global rate limiting
 *   7. Health check (no auth, no rate limit)
 *   8. API routes
 *   9. Sentry error handler  — DEVE stare dopo le route
 *  10. Catch-all 404 / 500
 */
import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import router from './routes/index.js';
import { logger, getRequestId } from './lib/logger.js';
import { requestContext } from './lib/request-context.js';
import { securityHeaders } from './lib/security-headers.js';
import { globalRateLimiter } from './lib/global-rate-limiter.js';
import { initSentry, getSentryErrorHandler } from './lib/sentry.js';
import { stripeWebhookHandler } from './routes/webhooks/stripe.js';

// ── 0. Sentry bootstrap — PRIMA di qualsiasi import che possa lanciare errori ──
await initSentry();

const app: Express = express();

app.set('trust proxy', 1);

// ── 1. Security headers ────────────────────────────────────────────────
app.use(securityHeaders);

// ── 2. Request context + requestId ──────────────────────────────────
// DEVE stare prima di pinoHttp: genera il requestId e avvia AsyncLocalStorage.
// Tutto il codice downstream (route, ai, db) che chiama getRequestLogger()
// ottiene automaticamente il logger con { requestId, userId, path, method }.
app.use(requestContext);

// ── 3. Request logging (pino-http) ──────────────────────────────────
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => (req as express.Request).requestId ?? randomUUID(),
    serializers: {
      req(req: Record<string, unknown>) {
        return {
          id:     req['id'],
          method: req['method'],
          url:    typeof req['url'] === 'string' ? req['url'].split('?')[0] : req['url'],
        };
      },
      res(res: Record<string, unknown>) {
        return { statusCode: res['statusCode'] };
      },
    },
    // Aggiunge requestId al log pino-http per correlazione con i child logger
    customProps: () => ({ requestId: getRequestId() }),
    // Non loggare le health check — sono troppo frequenti e rumorosi
    autoLogging: {
      ignore: (req) => (req as express.Request).url?.startsWith('/api/health') ?? false,
    },
  })
);

// ── 4. Webhook Stripe (DEVE stare PRIMA di express.json) ─────────────────
// Stripe verifica la firma sul body grezzo (Buffer).
// Se express.json() gira prima, il body viene parsato e la firma non corrisponde.
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  stripeWebhookHandler,
);

// ── 5. CORS + Body parsing ─────────────────────────────────────────────
const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5000';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── 6. Global rate limiting ────────────────────────────────────────────
app.use(globalRateLimiter);

// ── 7. Health check (no auth, no rate limit, esente da Sentry error handler) ──
app.use('/api/health', (await import('./routes/health.js')).default);

// ── 8. API routes ──────────────────────────────────────────────────────
app.use('/api', router);

// ── 9. Sentry error handler — DOPO le route, PRIMA del catch-all ──────────────
// Intercetta tutti gli errori lanciati nelle route e li invia a Sentry.
// DEVE avere la firma (err, req, res, next) — 4 parametri.
app.use(getSentryErrorHandler());

// ── 10. Catch-all 404 / 500 ─────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route non trovata' });
});

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = err instanceof Error ? err.message : 'Errore interno del server';
  logger.error({ err }, message);
  res.status(500).json({ error: 'Errore interno del server' });
});

export default app;
