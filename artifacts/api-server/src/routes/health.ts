/**
 * Health Routes — NorthStar Express
 *
 * GET /api/health        — combined check (backward compat) + dettagli per monitoring umano
 * GET /api/health/live   — liveness probe Kubernetes (sempre 200 se il processo gira)
 * GET /api/health/ready  — readiness probe Kubernetes (200 solo se DB + AI sani)
 *
 * Kubernetes pod spec suggerito:
 *
 *   livenessProbe:
 *     httpGet: { path: /api/health/live, port: 8080 }
 *     initialDelaySeconds: 10
 *     periodSeconds: 10
 *     failureThreshold: 3
 *
 *   readinessProbe:
 *     httpGet: { path: /api/health/ready, port: 8080 }
 *     initialDelaySeconds: 5
 *     periodSeconds: 5
 *     failureThreshold: 2
 *
 * Regole:
 *   - Nessuna autenticazione su questi endpoint — accessibili da orchestratore
 *   - Esenti da rate limiting (registrati prima di globalRateLimiter in app.ts)
 *   - Pino HTTP non logga request a /api/health/* (config in app.ts)
 *   - Timeout totale check: HEALTH_CHECK_TIMEOUT_MS env (default 2000ms)
 */
import { Router, Request, Response } from 'express';
import { runHealthChecks, type HealthCheckResult } from '../lib/health.js';

const router = Router();

// ─── GET /live — Liveness Probe ──────────────────────────────────────────────────────
//
// Non tocca DB né servizi esterni. Il pod è "vivo" se il processo risponde.
// Kubernetes usa questo per decidere se riavviare il container.

router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
    service: 'northstar-api',
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /ready — Readiness Probe ─────────────────────────────────────────────────
//
// Verifica DB + AI service + ML service in parallelo.
// Kubernetes usa questo per smettere di inviare traffico al pod se non è pronto.
// Status "unhealthy" (DB giù) → 503. Status "degraded" (solo AI giù) → 503.
// Il frontend può ispezionare il body per capire quale servizio è degradato.

router.get('/ready', async (_req: Request, res: Response) => {
  const result = await runHealthChecks();
  const httpStatus = result.status === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(result);
});

// ─── GET / — Combined (backward compat + monitoring umano) ──────────────────────
//
// Stesso logic di /ready, con i dettagli dei sub-check.
// Usato da dashboard interni, Grafana, Uptime monitoring (es. BetterUptime).

router.get('/', async (_req: Request, res: Response) => {
  const result: HealthCheckResult = await runHealthChecks();
  const httpStatus = result.status === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(result);
});

export default router;
