import { Router, type Request, type Response } from "express";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  aiRequestLogTable,
  coachSessionsTable,
  db,
  qualityMetrics,
  responseFeedbackTable,
  supervisorLogs,
} from "@workspace/db";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getRagMetricsSummary, register } from "@workspace/ai-server/metrics";
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

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

function safeSnippet(value: string | null | undefined, max = 180) {
  if (!value) return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max - 1)}…`
    : normalized;
}

function qualityStatus(
  score: number | null,
  rewriteRate: number,
  clarificationRate = 0,
) {
  if ((score != null && score < 0.6) || rewriteRate > 0.3) return "critical";
  if (
    (score != null && score < 0.75) ||
    rewriteRate > 0.15 ||
    clarificationRate > 0.2
  )
    return "attention";
  return "healthy";
}

function emptyQualityOverview(days: number, reason?: string) {
  return {
    generatedAt: new Date().toISOString(),
    days,
    persistenceUnavailable: Boolean(reason),
    reason: reason ?? null,
    setupAction: reason ? "run_migrations" : null,
    summary: {
      total: 0,
      avgEvalScore: null,
      avgSupervisorScore: null,
      rewriteRate: 0,
      clarificationRate: 0,
      toolUsageRate: 0,
      rewrites: 0,
      clarifications: 0,
      uiTools: 0,
      avgResponseTimeMs: null,
      supervisorRewriteCount: 0,
      avgScoreBeforeRewrite: null,
      avgScoreAfterRewrite: null,
      feedbackTotal: 0,
      negativeFeedback: 0,
      positiveFeedback: 0,
      negativeFeedbackRate: 0,
    },
    trends: [],
    domains: [],
    problemConversations: [],
    rewriteReasons: [],
    alerts: reason
      ? [
          {
            level: "attention" as const,
            title: "Metriche qualita non disponibili",
            message:
              "Applica le migration quality/feedback per popolare questa sezione.",
            domain: null,
          },
        ]
      : [],
  };
}

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

router.get("/quality/overview", async (req: Request, res: Response) => {
  const days = Math.max(1, Math.min(Number(req.query.days) || 30, 90));

  try {
    const limit = getLimit(req, 50, 100);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [
      totalsRows,
      domainRows,
      trendRows,
      aiTrendRows,
      supervisorRows,
      feedbackRows,
      problemSupervisorRows,
      negativeFeedbackRows,
    ] = await Promise.all([
      db
        .select({
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
          avgResponseTimeMs: sql<number>`avg(${qualityMetrics.responseTimeMs})::float`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since)),
      db
        .select({
          domain: qualityMetrics.domain,
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
          avgResponseTimeMs: sql<number>`avg(${qualityMetrics.responseTimeMs})::float`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since))
        .groupBy(qualityMetrics.domain)
        .orderBy(sql`avg(${qualityMetrics.evalScore}) asc nulls last`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${qualityMetrics.createdAt}), 'YYYY-MM-DD')`,
          total: sql<number>`count(*)::int`,
          avgEvalScore: sql<number>`avg(${qualityMetrics.evalScore})::float`,
          avgSupervisorScore: sql<number>`avg(${qualityMetrics.supervisorScore})::float`,
          rewrites: sql<number>`count(*) filter (where ${qualityMetrics.rewritten} = true)::int`,
          clarifications: sql<number>`count(*) filter (where ${qualityMetrics.needsClarification} = true)::int`,
          uiTools: sql<number>`count(*) filter (where ${qualityMetrics.usedUiTool} = true)::int`,
        })
        .from(qualityMetrics)
        .where(gte(qualityMetrics.createdAt, since))
        .groupBy(sql`date_trunc('day', ${qualityMetrics.createdAt})`)
        .orderBy(sql`date_trunc('day', ${qualityMetrics.createdAt}) asc`),
      db
        .select({
          day: sql<string>`to_char(date_trunc('day', ${aiRequestLogTable.createdAt}), 'YYYY-MM-DD')`,
          avgLatencyMs: sql<number>`avg(${aiRequestLogTable.latencyMs})::float`,
          aiRequests: sql<number>`count(*)::int`,
          aiErrors: sql<number>`count(*) filter (where ${aiRequestLogTable.status} <> 'success')::int`,
          toolCalls: sql<number>`coalesce(sum(${aiRequestLogTable.toolCallsCount}), 0)::int`,
        })
        .from(aiRequestLogTable)
        .where(gte(aiRequestLogTable.createdAt, since))
        .groupBy(sql`date_trunc('day', ${aiRequestLogTable.createdAt})`)
        .orderBy(sql`date_trunc('day', ${aiRequestLogTable.createdAt}) asc`),
      db
        .select({
          total: sql<number>`count(*)::int`,
          avgScoreBefore: sql<number>`avg(${supervisorLogs.scoreBefore})::float`,
          avgScoreAfter: sql<number>`avg(${supervisorLogs.scoreAfter})::float`,
        })
        .from(supervisorLogs)
        .where(gte(supervisorLogs.createdAt, since)),
      db
        .select({
          total: sql<number>`count(*)::int`,
          negative: sql<number>`count(*) filter (where ${responseFeedbackTable.rating} < 0)::int`,
          positive: sql<number>`count(*) filter (where ${responseFeedbackTable.rating} > 0)::int`,
        })
        .from(responseFeedbackTable)
        .where(gte(responseFeedbackTable.createdAt, since)),
      db
        .select({
          id: supervisorLogs.id,
          createdAt: supervisorLogs.createdAt,
          sessionId: supervisorLogs.sessionId,
          domain: supervisorLogs.domain,
          intent: supervisorLogs.intent,
          userMessage: supervisorLogs.userMessage,
          draft: supervisorLogs.draft,
          finalText: supervisorLogs.finalText,
          scoreBefore: supervisorLogs.scoreBefore,
          scoreAfter: supervisorLogs.scoreAfter,
          reasons: supervisorLogs.reasons,
        })
        .from(supervisorLogs)
        .where(gte(supervisorLogs.createdAt, since))
        .orderBy(supervisorLogs.scoreBefore, desc(supervisorLogs.createdAt))
        .limit(limit),
      db
        .select({
          id: responseFeedbackTable.id,
          createdAt: responseFeedbackTable.createdAt,
          sessionId: responseFeedbackTable.sessionId,
          messageIndex: responseFeedbackTable.messageIndex,
          rating: responseFeedbackTable.rating,
          comment: responseFeedbackTable.comment,
          title: coachSessionsTable.title,
        })
        .from(responseFeedbackTable)
        .leftJoin(
          coachSessionsTable,
          eq(responseFeedbackTable.sessionId, coachSessionsTable.id),
        )
        .where(
          and(
            gte(responseFeedbackTable.createdAt, since),
            sql`${responseFeedbackTable.rating} < 0`,
          ),
        )
        .orderBy(desc(responseFeedbackTable.createdAt))
        .limit(Math.min(limit, 25)),
    ]);

    const totals = totalsRows[0] ?? {
      total: 0,
      avgEvalScore: null,
      avgSupervisorScore: null,
      rewrites: 0,
      clarifications: 0,
      uiTools: 0,
      avgResponseTimeMs: null,
    };
    const feedback = feedbackRows[0] ?? { total: 0, negative: 0, positive: 0 };
    const supervisor = supervisorRows[0] ?? {
      total: 0,
      avgScoreBefore: null,
      avgScoreAfter: null,
    };
    const total = Number(totals.total) || 0;
    const rewrites = Number(totals.rewrites) || 0;
    const clarifications = Number(totals.clarifications) || 0;
    const uiTools = Number(totals.uiTools) || 0;
    const negativeFeedback = Number(feedback.negative) || 0;
    const feedbackTotal = Number(feedback.total) || 0;
    const rewriteRate = total > 0 ? rewrites / total : 0;
    const clarificationRate = total > 0 ? clarifications / total : 0;
    const toolUsageRate = total > 0 ? uiTools / total : 0;
    const negativeFeedbackRate =
      feedbackTotal > 0 ? negativeFeedback / feedbackTotal : 0;
    const summaryTotals = totals as {
      avgEvalScore: number | null;
      avgSupervisorScore: number | null;
    };
    const avgScore =
      summaryTotals.avgEvalScore != null
        ? Number(summaryTotals.avgEvalScore)
        : summaryTotals.avgSupervisorScore != null
          ? Number(summaryTotals.avgSupervisorScore)
          : null;

    const domains = domainRows.map((row) => {
      const rowTotal = Number(row.total) || 0;
      const rowRewrites = Number(row.rewrites) || 0;
      const rowClarifications = Number(row.clarifications) || 0;
      const score =
        row.avgEvalScore != null
          ? Number(row.avgEvalScore)
          : row.avgSupervisorScore != null
            ? Number(row.avgSupervisorScore)
            : null;
      const rowRewriteRate = rowTotal > 0 ? rowRewrites / rowTotal : 0;
      const rowClarificationRate =
        rowTotal > 0 ? rowClarifications / rowTotal : 0;
      return {
        domain: row.domain,
        total: rowTotal,
        avgEvalScore:
          row.avgEvalScore != null ? Number(row.avgEvalScore) : null,
        avgSupervisorScore:
          row.avgSupervisorScore != null
            ? Number(row.avgSupervisorScore)
            : null,
        rewrites: rowRewrites,
        clarifications: rowClarifications,
        uiTools: Number(row.uiTools) || 0,
        rewriteRate: rowRewriteRate,
        clarificationRate: rowClarificationRate,
        toolUsageRate: rowTotal > 0 ? (Number(row.uiTools) || 0) / rowTotal : 0,
        avgResponseTimeMs:
          row.avgResponseTimeMs != null
            ? Math.round(Number(row.avgResponseTimeMs))
            : null,
        status: qualityStatus(score, rowRewriteRate, rowClarificationRate),
      };
    });

    const aiByDay = new Map(aiTrendRows.map((row) => [row.day, row]));
    const trends = trendRows.map((row) => {
      const ai = aiByDay.get(row.day);
      const rowTotal = Number(row.total) || 0;
      const rowRewrites = Number(row.rewrites) || 0;
      const rowClarifications = Number(row.clarifications) || 0;
      const rowUiTools = Number(row.uiTools) || 0;
      return {
        day: row.day,
        total: rowTotal,
        avgEvalScore:
          row.avgEvalScore != null ? Number(row.avgEvalScore) : null,
        avgSupervisorScore:
          row.avgSupervisorScore != null
            ? Number(row.avgSupervisorScore)
            : null,
        rewriteRate: rowTotal > 0 ? rowRewrites / rowTotal : 0,
        clarificationRate: rowTotal > 0 ? rowClarifications / rowTotal : 0,
        toolUsageRate: rowTotal > 0 ? rowUiTools / rowTotal : 0,
        avgLatencyMs:
          ai?.avgLatencyMs != null ? Math.round(Number(ai.avgLatencyMs)) : null,
        aiRequests: ai ? Number(ai.aiRequests) || 0 : 0,
        aiErrors: ai ? Number(ai.aiErrors) || 0 : 0,
        toolCalls: ai ? Number(ai.toolCalls) || 0 : 0,
      };
    });

    const reasonCounts = new Map<string, number>();
    for (const row of problemSupervisorRows) {
      for (const reason of String(row.reasons ?? "")
        .split(/\n|;|,|\|/)
        .map((item) => item.trim())
        .filter(Boolean)) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }
    const rewriteReasons = Array.from(reasonCounts.entries())
      .map(([reason, count]) => ({ reason: safeSnippet(reason, 120), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const problemConversations = [
      ...problemSupervisorRows.map((row) => ({
        id: `supervisor-${row.id}`,
        source: "supervisor",
        createdAt: row.createdAt,
        sessionId: row.sessionId,
        domain: row.domain,
        intent: row.intent,
        score: row.scoreBefore,
        scoreAfter: row.scoreAfter,
        reason: safeSnippet(row.reasons, 180),
        snippet: safeSnippet(
          row.userMessage || row.draft || row.finalText,
          180,
        ),
      })),
      ...negativeFeedbackRows.map((row) => ({
        id: `feedback-${row.id}`,
        source: "feedback",
        createdAt: row.createdAt,
        sessionId: row.sessionId,
        domain: "feedback",
        intent: row.title ?? "session_feedback",
        score: null,
        scoreAfter: null,
        reason: safeSnippet(row.comment || "Feedback negativo", 180),
        snippet: `Sessione #${row.sessionId}, messaggio ${row.messageIndex}`,
      })),
    ]
      .sort(
        (a, b) =>
          new Date(b.createdAt as Date).getTime() -
          new Date(a.createdAt as Date).getTime(),
      )
      .slice(0, limit);

    const alerts: Array<{
      level: "attention" | "critical";
      title: string;
      message: string;
      domain: string | null;
    }> = [];
    if (avgScore != null && avgScore < 0.6) {
      alerts.push({
        level: "critical",
        title: "Score qualita critico",
        message: `Score medio ${(avgScore * 100).toFixed(0)}% sotto soglia 60%.`,
        domain: null,
      });
    } else if (avgScore != null && avgScore < 0.75) {
      alerts.push({
        level: "attention",
        title: "Score qualita in calo",
        message: `Score medio ${(avgScore * 100).toFixed(0)}% sotto soglia 75%.`,
        domain: null,
      });
    }
    if (rewriteRate > 0.3) {
      alerts.push({
        level: "critical",
        title: "Rewrite rate alto",
        message: `${(rewriteRate * 100).toFixed(1)}% dei turni richiede rewrite.`,
        domain: null,
      });
    } else if (rewriteRate > 0.15) {
      alerts.push({
        level: "attention",
        title: "Rewrite rate da monitorare",
        message: `${(rewriteRate * 100).toFixed(1)}% dei turni richiede rewrite.`,
        domain: null,
      });
    }
    if (clarificationRate > 0.2) {
      alerts.push({
        level: "attention",
        title: "Troppe chiarificazioni",
        message: `${(clarificationRate * 100).toFixed(1)}% dei turni chiede chiarimenti.`,
        domain: null,
      });
    }
    if (negativeFeedbackRate > 0.25 && negativeFeedback >= 3) {
      alerts.push({
        level: "critical",
        title: "Feedback negativo alto",
        message: `${negativeFeedback} feedback negativi su ${feedbackTotal}.`,
        domain: null,
      });
    }
    for (const domain of domains
      .filter((item) => item.status !== "healthy")
      .slice(0, 5)) {
      alerts.push({
        level: domain.status === "critical" ? "critical" : "attention",
        title: `Dominio ${domain.domain} ${domain.status === "critical" ? "critico" : "debole"}`,
        message: `${domain.total} turni, rewrite ${(domain.rewriteRate * 100).toFixed(1)}%, chiarificazioni ${(domain.clarificationRate * 100).toFixed(1)}%.`,
        domain: domain.domain,
      });
    }

    writeAuditLog(req, {
      action: "admin_quality_overview_view",
      category: "admin_action",
      metadata: { days, total, alerts: alerts.length },
    });

    res.json({
      generatedAt: new Date().toISOString(),
      days,
      summary: {
        total,
        avgEvalScore:
          totals.avgEvalScore != null ? Number(totals.avgEvalScore) : null,
        avgSupervisorScore:
          totals.avgSupervisorScore != null
            ? Number(totals.avgSupervisorScore)
            : null,
        rewriteRate,
        clarificationRate,
        toolUsageRate,
        rewrites,
        clarifications,
        uiTools,
        avgResponseTimeMs:
          totals.avgResponseTimeMs != null
            ? Math.round(Number(totals.avgResponseTimeMs))
            : null,
        supervisorRewriteCount: Number(supervisor.total) || 0,
        avgScoreBeforeRewrite:
          supervisor.avgScoreBefore != null
            ? Number(supervisor.avgScoreBefore)
            : null,
        avgScoreAfterRewrite:
          supervisor.avgScoreAfter != null
            ? Number(supervisor.avgScoreAfter)
            : null,
        feedbackTotal,
        negativeFeedback,
        positiveFeedback: Number(feedback.positive) || 0,
        negativeFeedbackRate,
      },
      trends,
      domains,
      problemConversations,
      rewriteReasons,
      alerts,
    });
  } catch (err) {
    rootLogger.warn(
      { err },
      "[admin/quality/overview] returning empty overview after read failure",
    );
    res.json(emptyQualityOverview(days, "quality_overview_unavailable"));
  }
});

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
