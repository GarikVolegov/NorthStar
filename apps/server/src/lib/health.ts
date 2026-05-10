/**
 * Health Check Module — NorthStar Express
 *
 * Espone due livelli di check secondo il pattern Kubernetes:
 *
 *   /api/health/live    (Liveness Probe)
 *     → 200 sempre finché il processo è in ascolto.
 *     → Usato da Kubernetes per decidere se RIAVVIARE il pod.
 *     → Non toccare DB o servizi esterni (deadlock se il pod non risponde).
 *
 *   /api/health/ready   (Readiness Probe)
 *     → 200 solo se DB + AI service sono raggiungibili.
 *     → Usato da Kubernetes per decidere se INVIARE TRAFFICO al pod.
 *     → 503 se uno o più servizi vitali non rispondono.
 *
 *   /api/health         (Combined — backward compat)
 *     → Stessa logica di /ready, più dettagli. Usato da monitoring umano.
 *
 * Design:
 *   - Tutti i check girano in parallelo (Promise.allSettled) — nessun check
 *     aspetta il precedente. Latenza totale = max(latenze singole).
 *   - Timeout di 2s per check. Se scatta → stato "degraded".
 *   - Nessun logging delle request a /health (già escluso in pino-http config).
 *   - Nessun rate limiting su /health (esente per design, registrato prima del globalRateLimiter).
 */
import { sql } from 'drizzle-orm';
import { db } from '@workspace/db';
import { logger } from './logger.js';

const AI_AGENTS_URL  = process.env.AI_AGENTS_URL  ?? 'http://localhost:8000';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? process.env.AI_AGENTS_URL ?? 'http://localhost:8000';
const HEALTH_TIMEOUT_MS = parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS ?? '2000', 10);

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type CheckStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface SubCheckResult {
  status:      CheckStatus;
  latencyMs:   number;
  detail?:     string;  // messaggio di errore (mai stack trace)
}

export interface HealthCheckResult {
  status:      CheckStatus;
  timestamp:   string;
  uptimeSeconds: number;
  checks: {
    database:   SubCheckResult;
    aiService:  SubCheckResult;
    mlService:  SubCheckResult;
  };
  version: string;
}

// ─── Helper: timeout wrapper ────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout dopo ${ms}ms`)), ms),
    ),
  ]);
}

// ─── Check 1: Database — SELECT 1 ─────────────────────────────────────────────
//
// Usa Drizzle per eseguire SELECT 1 — la query più leggera possibile.
// Verifica: connessione al pool attiva, DB risponde, autenticazione ok.
// NON usa query su tabelle applicative (evita falsi negativi da schema vuoto).

async function checkDatabase(): Promise<SubCheckResult> {
  const start = Date.now();
  try {
    await withTimeout(
      db.execute(sql`SELECT 1`),
      HEALTH_TIMEOUT_MS,
    );
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    const isTimeout = (err as Error).message.includes('Timeout');
    logger.warn({ err: (err as Error).message }, 'Health check: database unhealthy');
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      detail: isTimeout ? 'DB timeout' : 'DB unreachable',
    };
  }
}

// ─── Check 2: AI Agents Service (FastAPI porta 8000) ──────────────────────────
//
// GET /health sull'AI service. Verifica che il microservizio Python risponda.
// Consideriamo il servizio AI come non-critico per la readiness di base:
// se il DB è ok ma l'AI non risponde, lo status finale è "degraded" (non "unhealthy").
// In questo modo Kubernetes continua ad inviare traffico per le route non-AI.

async function checkAiService(): Promise<SubCheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${AI_AGENTS_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      return {
        status: 'degraded',
        latencyMs: Date.now() - start,
        detail: `AI service HTTP ${res.status}`,
      };
    }
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = (err as Error).name === 'AbortError';
    logger.warn({ err: (err as Error).message }, 'Health check: AI service degraded');
    return {
      status: 'degraded',
      latencyMs: Date.now() - start,
      detail: isAbort ? 'AI service timeout' : 'AI service unreachable',
    };
  }
}

// ─── Check 3: ML Service (stesso processo FastAPI, endpoint /ml/health) ────────
//
// Verifica che il modello scikit-learn sia caricato e operativo.
// Considera il ML come non-critico (stesso trattamento AI service).

async function checkMlService(): Promise<SubCheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${ML_SERVICE_URL}/ml/health`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      return { status: 'degraded', latencyMs: Date.now() - start, detail: `ML service HTTP ${res.status}` };
    }
    const body = await res.json().catch(() => ({}));
    return {
      status: 'healthy',
      latencyMs: Date.now() - start,
      detail: body?.model_version ?? body?.version,
    };
  } catch (err) {
    clearTimeout(timeoutId);
    const isAbort = (err as Error).name === 'AbortError';
    return {
      status: 'degraded',
      latencyMs: Date.now() - start,
      detail: isAbort ? 'ML service timeout' : 'ML service unreachable',
    };
  }
}

// ─── Logica di aggregazione ───────────────────────────────────────────────────────
//
// Regola:
//   - database unhealthy  → status "unhealthy"  (HTTP 503)
//   - AI/ML degraded      → status "degraded"   (HTTP 503 con fallback flag)
//   - tutto healthy       → status "healthy"    (HTTP 200)
//
// I check AI e ML non determinano "unhealthy" da soli perché la piattaforma
// può servire le route non-AI (login, CV viewer, profile) anche senza di loro.

const _startTime = Date.now();

export async function runHealthChecks(): Promise<HealthCheckResult> {
  // Tutti e 3 i check in parallelo — latenza totale = max(latenze)
  const [dbResult, aiResult, mlResult] = await Promise.all([
    checkDatabase(),
    checkAiService(),
    checkMlService(),
  ]);

  // Aggregazione status
  let overallStatus: CheckStatus = 'healthy';
  if (dbResult.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  } else if (
    aiResult.status !== 'healthy' ||
    mlResult.status !== 'healthy'
  ) {
    overallStatus = 'degraded';
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - _startTime) / 1000),
    checks: {
      database:  dbResult,
      aiService: aiResult,
      mlService: mlResult,
    },
    version: process.env.npm_package_version ?? 'unknown',
  };
}
