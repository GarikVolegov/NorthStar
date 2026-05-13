import { Router, type Request, type Response } from "express";
import { db, supervisorLogs, qualityMetrics } from "@workspace/db";
import { sql } from "drizzle-orm";
import { register } from "@workspace/ai-server/metrics";
import { writeAuditLog } from "../middleware/audit";

const router = Router();

function adminAuth(req: Request, res: Response): boolean {
  const key = req.headers["x-admin-key"];
  if (key !== process.env.ADMIN_API_KEY) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

router.get("/quality", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

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
      metadata: { domains: supervisorStats.map((s: any) => s.domain) },
    });

    res.json({
      supervisorStats,
      qualityStats,
      totals: totals[0] ?? { total: 0, avgEvalScore: 0, avgSupervisorScore: 0, rewrites: 0, clarifications: 0, uiTools: 0 },
    });
  } catch (err) {
    console.error("[admin/quality] query failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

// ── Wendy Prometheus metrics as JSON ───────────────────────────────

function metricToJson(metricName: string) {
  const m = register.getSingleMetric(metricName);
  if (!m) return null;
  const data = (m as any).get();
  return {
    name: data.name,
    help: data.help,
    type: data.type,
    values: data.values ?? [],
  };
}

router.get("/wendy-metrics", async (req: Request, res: Response) => {
  if (!adminAuth(req, res)) return;

  try {
    const requests = metricToJson("wendy_requests_total");
    const latency = metricToJson("wendy_latency_seconds");
    const rewrites = metricToJson("wendy_supervisor_rewrites_total");
    const tokens = metricToJson("wendy_llm_tokens_total");
    const confidence = metricToJson("wendy_router_confidence_histogram");

    // Aggregate volume per domain from requests
    const volumeByDomain: Record<string, number> = {};
    if (requests?.values) {
      for (const v of requests.values) {
        const domain = v.labels?.domain ?? "unknown";
        volumeByDomain[domain] = (volumeByDomain[domain] ?? 0) + (v.value ?? 0);
      }
    }

    // Aggregate rewrite rate
    const totalRequests = Object.values(volumeByDomain).reduce((a, b) => a + b, 0);
    const totalRewrites = rewrites?.values?.reduce((s: number, v: any) => s + (v.value ?? 0), 0) ?? 0;
    const rewriteRate = totalRequests > 0 ? totalRewrites / totalRequests : 0;

    // Aggregate avg latency per phase from latency histogram
    const latencyByPhase: Record<string, { sum: number; count: number }> = {};
    if (latency?.values) {
      for (const v of latency.values) {
        const phase = v.labels?.phase ?? "unknown";
        if (!latencyByPhase[phase]) latencyByPhase[phase] = { sum: 0, count: 0 };
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
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[admin/wendy-metrics] error:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
