import { Router, type Request, type Response } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  db,
  qualityMetrics,
  supervisorLogs,
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { getRagMetricsSummary, register } from "@workspace/ai-server/metrics";
import { registerQualityOverviewRoute } from "./quality-overview";
import { getModelRoutingPolicy } from "@workspace/ai-server";
import { writeAuditLog } from "../../middleware/audit";
import { rootLogger } from "../../middleware/logger";

const router = Router();
interface PrometheusMetricValue {
  value?: number;
  metricName?: string;
  labels?: Record<string, string | number>;
}

interface PrometheusMetricJson {
  name?: string;
  help?: string;
  type?: string;
  values?: PrometheusMetricValue[];
}

interface PrometheusMetricWithGet {
  get(): Promise<PrometheusMetricJson> | PrometheusMetricJson;
}
const TECH_DEBT_HISTORY_PATH = resolve(
  process.cwd(),
  "docs",
  "quality",
  "tech-debt-history.json",
);

router.get("/ai/model-policy", async (_req: Request, res: Response) => {
  try {
    res.json({
      generatedAt: new Date().toISOString(),
      policy: getModelRoutingPolicy(),
      notes: [
        "Con AI_PROVIDER=openrouter la policy usa solo openrouter/free o model ID con suffisso :free.",
        "Gli override env MODEL_* sono accettati solo se gratuiti, salvo ALLOW_PAID_AI_MODELS=true.",
      ],
    });
  } catch (err) {
    rootLogger.warn({ err }, "[admin/ai/model-policy] policy unavailable");
    res.json({
      generatedAt: new Date().toISOString(),
      policy: null,
      notes: ["Policy modelli temporaneamente non disponibile."],
    });
  }
});

router.get("/quality", async (req: Request, res: Response) => {
  try {
    const supervisorStats = await db
      .select({
        domain: supervisorLogs.domain,
        total: sql<number>`count(*)::int`,
        avgScoreBefore: sql<number>`avg(${supervisorLogs.scoreBefore})::float`,
        avgScoreAfter: sql<number>`avg(${supervisorLogs.scoreAfter})::float`,
      })
      .from(supervisorLogs)
      .groupBy(supervisorLogs.domain)
      .orderBy(supervisorLogs.domain);

    const qualityStats = await db
      .select({
        domain: qualityMetrics.domain,
        total: sql<number>`count(*)::int`,
        avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
        avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
        rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
        clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
        uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
      })
      .from(qualityMetrics)
      .groupBy(qualityMetrics.domain)
      .orderBy(qualityMetrics.domain);

    const totals = await db
      .select({
        total: sql<number>`count(*)::int`,
        avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
        avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
        rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
        clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
        uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
      })
      .from(qualityMetrics);

    writeAuditLog(req, {
      action: "admin_quality_view",
      category: "admin_action",
      metadata: { domains: supervisorStats.map((s) => s.domain) },
    });

    res.json({
      supervisorStats,
      qualityStats,
      totals: totals[0] ?? {
        total: 0,
        avgEvalScore: 0,
        avgSupervisorScore: 0,
        rewrites: 0,
        clarifications: 0,
        uiTools: 0,
      },
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/quality] query failed");
    res.status(500).json({ error: String(err) });
  }
});

// ── Wendy Prometheus metrics as JSON ───────────────────────────────

registerQualityOverviewRoute(router);

async function metricToJson(metricName: string) {
  const m = register.getSingleMetric(metricName);
  if (!m) return null;
  const data = await (m as PrometheusMetricWithGet).get();
  return {
    name: data.name,
    help: data.help,
    type: data.type,
    values: data.values ?? [],
  };
}

interface TechDebtSnapshot {
  sprint: string;
  date: string;
  metrics?: Record<string, number>;
  tracked?: Record<string, number>;
  gated?: Record<string, number>;
}

function getTechDebtGateStatus(
  latest: TechDebtSnapshot | null,
  previous: TechDebtSnapshot | null,
): "ok" | "warning" {
  if (!latest || !previous) return "ok";
  const latestGated = latest.gated ?? latest.metrics ?? {};
  const previousGated = previous.gated ?? previous.metrics ?? {};
  return Object.entries(latestGated).some(
    ([key, value]) => value > (previousGated[key] ?? 0),
  )
    ? "warning"
    : "ok";
}

router.get("/tech-debt-metrics", async (_req: Request, res: Response) => {
  try {
    const raw = await readFile(TECH_DEBT_HISTORY_PATH, "utf8");
    const parsed = JSON.parse(raw) as { sprints?: TechDebtSnapshot[] };
    const history = Array.isArray(parsed.sprints) ? parsed.sprints : [];
    const latest = history.at(-1) ?? null;
    const previous = history.at(-2) ?? null;

    res.json({
      latest,
      previous,
      history,
      gateStatus: getTechDebtGateStatus(latest, previous),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    rootLogger.warn({ err }, "[admin/tech-debt-metrics] history unavailable");
    res.json({
      latest: null,
      previous: null,
      history: [],
      gateStatus: "warning",
      generatedAt: new Date().toISOString(),
    });
  }
});

router.get("/wendy-metrics", async (_req: Request, res: Response) => {
  try {
    const [requests, latency, rewrites, confidence, rag] = await Promise.all([
      metricToJson("wendy_requests_total"),
      metricToJson("wendy_latency_seconds"),
      metricToJson("wendy_supervisor_rewrites_total"),
      metricToJson("wendy_router_confidence_histogram"),
      getRagMetricsSummary(),
    ]);

    // Aggregate volume per domain from requests
    const volumeByDomain: Record<string, number> = {};
    if (requests?.values) {
      for (const v of requests.values) {
        const domain = v.labels?.domain ?? "unknown";
        volumeByDomain[domain] = (volumeByDomain[domain] ?? 0) + (v.value ?? 0);
      }
    }

    // Aggregate rewrite rate
    const totalRequests = Object.values(volumeByDomain).reduce(
      (a, b) => a + b,
      0,
    );
    const totalRewrites =
      rewrites?.values?.reduce((s, v) => s + (v.value ?? 0), 0) ?? 0;
    const rewriteRate = totalRequests > 0 ? totalRewrites / totalRequests : 0;

    // Aggregate avg latency per phase from latency histogram
    const latencyByPhase: Record<string, { sum: number; count: number }> = {};
    if (latency?.values) {
      for (const v of latency.values) {
        const phase = v.labels?.phase ?? "unknown";
        if (!latencyByPhase[phase])
          latencyByPhase[phase] = { sum: 0, count: 0 };
        // prometheus histograms have _sum and _count buckets
        if (v.metricName?.endsWith("_sum")) {
          latencyByPhase[phase].sum += v.value ?? 0;
        } else if (v.metricName?.endsWith("_count")) {
          latencyByPhase[phase].count += v.value ?? 0;
        }
      }
    }

    res.json({
      volumeByDomain,
      totalRequests,
      totalRewrites,
      rewriteRate,
      latencyByPhase,
      confidence,
      rag,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/wendy-metrics] error");
    res.status(500).json({ error: String(err) });
  }
});

export default router;
