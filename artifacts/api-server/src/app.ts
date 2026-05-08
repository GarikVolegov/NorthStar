import express, { type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import router from './routes/index.js';
import { logger, getRequestId } from './lib/logger.js';
import { requestContext } from './lib/request-context.js';
import { securityHeaders } from './lib/security-headers.js';
import { globalRateLimiter } from './lib/global-rate-limiter.js';

const app: Express = express();

app.set('trust proxy', 1);

// ─── 1. Security headers ──────────────────────────────────────────────────────
app.use(securityHeaders);

// ─── 2. Request context + requestId ──────────────────────────────────────────
// DEVE stare prima di pinoHttp: genera il requestId e avvia AsyncLocalStorage.
// Tutto il codice downstream (route, ai, db) che chiama getRequestLogger()
// ottiene automaticamente il logger con { requestId, userId, path, method }.
app.use(requestContext);

// ─── 3. Request logging (pino-http) ──────────────────────────────────────────
// genReqId usa il requestId già generato da requestContext — no doppio UUID.
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
  })
);

// ─── 4. Body parsing ──────────────────────────────────────────────────────────
const allowedOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5000';
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── 5. Global rate limiting ──────────────────────────────────────────────────
app.use(globalRateLimiter);

// ─── 6. Health check (no auth, no rate limit) ─────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'northstar-api', timestamp: new Date().toISOString() });
});

// ─── 7. API routes ────────────────────────────────────────────────────────────
app.use('/api', router);

export default app;
