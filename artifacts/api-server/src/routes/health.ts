import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";

const router: IRouter = Router();

const START_TIME = Date.now();

const OPTIONAL_VARS = [
  "JWT_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "GNEWS_API_KEY",
  "TAVILY_API_KEY",
  "RESEND_API_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_EMAIL",
  "GOOGLE_CLIENT_ID",
];

const REQUIRED_VARS = ["DATABASE_URL", "ADMIN_KEY", "AI_AGENTS_URL"];

// ─── GET /api/healthz ─────────────────────────────────────────────────────────
// Liveness probe — risposta rapida per load balancer e uptime monitor.
router.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────
// Full health check: DB, Python AI Service, OpenAI integration, env vars.
router.get("/health", async (_req, res): Promise<void> => {
  const AI_AGENTS_URL = process.env.AI_AGENTS_URL ?? "http://localhost:8000";
  const OPENAI_BASE_URL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

  // Run all service checks in parallel
  const [dbResult, aiResult, openaiResult] = await Promise.all([
    checkDatabase(),
    checkAiService(AI_AGENTS_URL),
    checkOpenAI(OPENAI_BASE_URL),
  ]);

  // Env var status
  const missingRequired = REQUIRED_VARS.filter((k) => !process.env[k]);
  const missingOptional = OPTIONAL_VARS.filter((k) => !process.env[k]);
  const totalVars = REQUIRED_VARS.length + OPTIONAL_VARS.length;
  const configuredVars =
    REQUIRED_VARS.filter((k) => !!process.env[k]).length +
    OPTIONAL_VARS.filter((k) => !!process.env[k]).length;

  // Overall status — OpenAI degraded is not a hard error (gracefully disabled)
  const hasError = dbResult.status === "error" || missingRequired.length > 0;
  const hasDegraded =
    aiResult.status !== "ok" ||
    openaiResult.status !== "ok" ||
    missingOptional.length > 0;
  const overallStatus = hasError ? "error" : hasDegraded ? "degraded" : "ok";

  const statusCode = hasError ? 503 : 200;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    services: {
      database: dbResult,
      aiAgents: aiResult,
      openai: openaiResult,
    },
    env: {
      configured: configuredVars,
      total: totalVars,
      missingRequired,
      missingOptional,
    },
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function checkDatabase(): Promise<{ status: string; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  try {
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
    } finally {
      client.release();
    }
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    return {
      status: "error",
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checkAiService(baseUrl: string): Promise<{ status: string; latencyMs: number; error?: string }> {
  const t0 = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const r = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!r.ok) {
      return { status: "error", latencyMs: Date.now() - t0, error: `HTTP ${r.status}` };
    }
    return { status: "ok", latencyMs: Date.now() - t0 };
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      status: isTimeout ? "timeout" : "unreachable",
      latencyMs: Date.now() - t0,
      error: isTimeout ? "timeout after 3s" : (err instanceof Error ? err.message : String(err)),
    };
  }
}

async function checkOpenAI(
  baseUrl: string | undefined,
): Promise<{ status: string; latencyMs: number; configured: boolean; error?: string }> {
  if (!baseUrl) {
    return {
      status: "not_configured",
      latencyMs: 0,
      configured: false,
      error: "AI_INTEGRATIONS_OPENAI_BASE_URL non impostato — integrazione Replit OpenAI non attiva",
    };
  }

  const t0 = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    // Probe the models endpoint — lightweight, no token consumed
    const r = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "dummy"}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    // 200 or 401 both mean the endpoint is reachable
    if (r.ok || r.status === 401 || r.status === 403) {
      return { status: "ok", latencyMs: Date.now() - t0, configured: true };
    }
    return {
      status: "error",
      latencyMs: Date.now() - t0,
      configured: true,
      error: `HTTP ${r.status}`,
    };
  } catch (err) {
    clearTimeout(timeout);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      status: isTimeout ? "timeout" : "unreachable",
      latencyMs: Date.now() - t0,
      configured: true,
      error: isTimeout ? "timeout after 4s" : (err instanceof Error ? err.message : String(err)),
    };
  }
}

export default router;
