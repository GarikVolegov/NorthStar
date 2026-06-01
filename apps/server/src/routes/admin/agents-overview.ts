import { type Request, type Response, type Router } from "express";
import { agentRunsTable, aiRequestLogTable, db, llmUsageTable } from "@workspace/db";
import { and, desc, gte, sql } from "drizzle-orm";
import { rootLogger } from "../../middleware/logger";
import { buildAgentControlRoom } from "../../lib/admin-agent-control-room";
import {
  emptyAgentsOverview,
  formatRecentAgentRuns,
  optionalAdminRead,
  RUNNABLE_AGENTS,
  RUNNABLE_PIPELINES,
} from "./shared/agents";

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function registerAgentOverviewRoutes(router: Router): void {
  router.get("/agent-health", async (_req: Request, res: Response) => {
    try {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const rows = await db
        .select({
          agentName: agentRunsTable.agentName,
          totalCalls30d: sql<number>`count(*)::int`,
          errorCount30d: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'failed')::int`,
          avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
        })
        .from(agentRunsTable)
        .where(gte(agentRunsTable.startedAt, since))
        .groupBy(agentRunsTable.agentName)
        .orderBy(agentRunsTable.agentName);

      res.json({
        generatedAt: new Date().toISOString(),
        agents: rows.map((row) => {
          const total = Number(row.totalCalls30d) || 0;
          const errors = Number(row.errorCount30d) || 0;
          const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
          return {
            agentName: row.agentName,
            totalCalls30d: total,
            errorCount30d: errors,
            avgDurationMs: row.avgDurationMs ?? null,
            successRate30d: successRate,
            status: successRate >= 95 ? "healthy" : successRate >= 80 ? "degraded" : "critical",
          };
        }),
      });
    } catch (err) {
      rootLogger.error({ err }, "[admin/agent-health] error");
      res.status(500).json({ error: String(err) });
    }
  });

  router.get("/agents/overview", async (req: Request, res: Response) => {
    const days = Math.max(1, Math.min(Number(req.query.days) || 30, 90));

    try {
      const limit = getLimit(req, 100, 200);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const fallbackOverview = emptyAgentsOverview(days);
      const fallbackControlRoom = fallbackOverview.controlRoom as Awaited<ReturnType<typeof buildAgentControlRoom>>;
      const fallbackLlmCostRows = [{
        estimatedCostUsd: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        requestCount: 0,
      }];
      const fallbackAiRequestRows = [{
        aiRequestCostUsd: 0,
        aiRequestTokens: 0,
        aiRequests: 0,
        aiErrors: 0,
      }];

      const [agentRows, recentRunRows, recentErrors] = await Promise.all([
        db
          .select({
            agentName: agentRunsTable.agentName,
            totalCalls: sql<number>`count(*)::int`,
            completed: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'completed')::int`,
            running: sql<number>`count(*) filter (where ${agentRunsTable.status} = 'running')::int`,
            errorCount: sql<number>`count(*) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))::int`,
            avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
            lastRunAt: sql<Date>`max(${agentRunsTable.startedAt})`,
            lastErrorAt: sql<Date>`max(${agentRunsTable.startedAt}) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))`,
          })
          .from(agentRunsTable)
          .where(gte(agentRunsTable.startedAt, since))
          .groupBy(agentRunsTable.agentName)
          .orderBy(agentRunsTable.agentName),
        db
          .select({
            id: agentRunsTable.id,
            agentName: agentRunsTable.agentName,
            taskType: agentRunsTable.taskType,
            inputSummary: agentRunsTable.inputSummary,
            outputSummary: agentRunsTable.outputSummary,
            status: agentRunsTable.status,
            startedAt: agentRunsTable.startedAt,
            finishedAt: agentRunsTable.finishedAt,
            durationMs: agentRunsTable.durationMs,
            errorMessage: agentRunsTable.errorMessage,
          })
          .from(agentRunsTable)
          .where(gte(agentRunsTable.startedAt, since))
          .orderBy(desc(agentRunsTable.startedAt))
          .limit(limit),
        db
          .select({
            id: agentRunsTable.id,
            agentName: agentRunsTable.agentName,
            taskType: agentRunsTable.taskType,
            startedAt: agentRunsTable.startedAt,
            durationMs: agentRunsTable.durationMs,
            errorMessage: agentRunsTable.errorMessage,
            status: agentRunsTable.status,
          })
          .from(agentRunsTable)
          .where(and(gte(agentRunsTable.startedAt, since), sql`${agentRunsTable.status} in ('failed', 'cancelled')`))
          .orderBy(desc(agentRunsTable.startedAt))
          .limit(Math.min(limit, 50)),
      ]);

      const [llmCostRead, llmProviderRead, aiRequestRead, controlRoomRead] = await Promise.all([
        optionalAdminRead(
          () => db
            .select({
              estimatedCostUsd: sql<number>`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0)`,
              totalTokens: sql<number>`coalesce(sum(${llmUsageTable.totalTokens}), 0)::int`,
              promptTokens: sql<number>`coalesce(sum(${llmUsageTable.promptTokens}), 0)::int`,
              completionTokens: sql<number>`coalesce(sum(${llmUsageTable.completionTokens}), 0)::int`,
              requestCount: sql<number>`count(*)::int`,
            })
            .from(llmUsageTable)
            .where(gte(llmUsageTable.createdAt, since)),
          fallbackLlmCostRows,
        ),
        optionalAdminRead(
          () => db
            .select({
              provider: llmUsageTable.provider,
              costUsd: sql<number>`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0)`,
              tokens: sql<number>`coalesce(sum(${llmUsageTable.totalTokens}), 0)::int`,
              requests: sql<number>`count(*)::int`,
            })
            .from(llmUsageTable)
            .where(gte(llmUsageTable.createdAt, since))
            .groupBy(llmUsageTable.provider)
            .orderBy(sql`coalesce(sum(${llmUsageTable.estimatedCostUsd}), 0) desc`),
          [],
        ),
        optionalAdminRead(
          () => db
            .select({
              aiRequestCostUsd: sql<number>`coalesce(sum(${aiRequestLogTable.costUsdEst}), 0)`,
              aiRequestTokens: sql<number>`coalesce(sum(${aiRequestLogTable.inputTokens} + ${aiRequestLogTable.outputTokens}), 0)::int`,
              aiRequests: sql<number>`count(*)::int`,
              aiErrors: sql<number>`count(*) filter (where ${aiRequestLogTable.status} <> 'success')::int`,
            })
            .from(aiRequestLogTable)
            .where(gte(aiRequestLogTable.createdAt, since)),
          fallbackAiRequestRows,
        ),
        optionalAdminRead(() => buildAgentControlRoom(), fallbackControlRoom),
      ]);

      const optionalFailures: Array<{ label: string; error?: string }> = [];
      const pushOptionalFailure = (label: string, error?: string) => {
        optionalFailures.push(error ? { label, error } : { label });
      };
      if (llmCostRead.unavailable) pushOptionalFailure("llm_costs", llmCostRead.error);
      if (llmProviderRead.unavailable) pushOptionalFailure("llm_providers", llmProviderRead.error);
      if (aiRequestRead.unavailable) pushOptionalFailure("ai_request_log", aiRequestRead.error);
      if (controlRoomRead.unavailable) pushOptionalFailure("control_room", controlRoomRead.error);
      if (optionalFailures.length > 0) {
        rootLogger.warn({ failures: optionalFailures }, "[admin/agents/overview] optional reads unavailable");
      }

      const llmCostRows = llmCostRead.value;
      const llmProviderRows = llmProviderRead.value;
      const aiRequestRows = aiRequestRead.value;
      const controlRoom = controlRoomRead.value;

      const agents = agentRows.map((row) => {
        const total = Number(row.totalCalls) || 0;
        const errors = Number(row.errorCount) || 0;
        const errorRate = total > 0 ? errors / total : 0;
        const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
        const status = errorRate > 0.2 ? "critical" : errorRate >= 0.05 ? "degraded" : "healthy";
        return {
          agentName: row.agentName,
          totalCalls30d: total,
          completed30d: Number(row.completed) || 0,
          running30d: Number(row.running) || 0,
          errorCount30d: errors,
          errorRate30d: Math.round(errorRate * 100),
          successRate30d: successRate,
          avgDurationMs: row.avgDurationMs ?? null,
          lastRunAt: toIsoString(row.lastRunAt),
          lastErrorAt: toIsoString(row.lastErrorAt),
          status,
        };
      });
      const recentRuns = formatRecentAgentRuns(recentRunRows);
      const totalRuns = agents.reduce((sum, agent) => sum + agent.totalCalls30d, 0);
      const failedRuns = agents.reduce((sum, agent) => sum + agent.errorCount30d, 0);
      const runningRuns = agents.reduce((sum, agent) => sum + agent.running30d, 0);
      const avgDurationValues = agents
        .map((agent) => agent.avgDurationMs)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const avgDurationMs = avgDurationValues.length > 0
        ? Math.round(avgDurationValues.reduce((sum, value) => sum + value, 0) / avgDurationValues.length)
        : null;
      const llmCosts = llmCostRows[0] ?? {
        estimatedCostUsd: 0,
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        requestCount: 0,
      };
      const aiRequests = aiRequestRows[0] ?? {
        aiRequestCostUsd: 0,
        aiRequestTokens: 0,
        aiRequests: 0,
        aiErrors: 0,
      };
      const llmCost = Number(llmCosts.estimatedCostUsd) || 0;
      const aiRequestCost = Number(aiRequests.aiRequestCostUsd) || 0;

      res.json({
        generatedAt: new Date().toISOString(),
        summary: {
          totalRuns,
          totalAgents: agents.length,
          successRate30d: totalRuns > 0 ? Math.round(((totalRuns - failedRuns) / totalRuns) * 100) : 100,
          avgDurationMs,
          failedRuns,
          runningRuns,
          degradedAgents: agents.filter((agent) => agent.status === "degraded").length,
          criticalAgents: agents.filter((agent) => agent.status === "critical").length,
          costUsd30d: Math.max(llmCost, aiRequestCost),
          totalTokens30d: Math.max(Number(llmCosts.totalTokens) || 0, Number(aiRequests.aiRequestTokens) || 0),
          aiRequests30d: Math.max(Number(llmCosts.requestCount) || 0, Number(aiRequests.aiRequests) || 0),
          aiErrors30d: Number(aiRequests.aiErrors) || 0,
        },
        agents,
        recentRuns,
        recentErrors,
        costs: {
          days,
          estimatedCostUsd: llmCost,
          totalTokens: Number(llmCosts.totalTokens) || 0,
          promptTokens: Number(llmCosts.promptTokens) || 0,
          completionTokens: Number(llmCosts.completionTokens) || 0,
          requestCount: Number(llmCosts.requestCount) || 0,
          aiRequestCostUsd: aiRequestCost,
          aiRequestTokens: Number(aiRequests.aiRequestTokens) || 0,
          aiRequestCount: Number(aiRequests.aiRequests) || 0,
          aiErrorCount: Number(aiRequests.aiErrors) || 0,
          byProvider: llmProviderRows.map((row) => ({
            provider: row.provider,
            costUsd: Number(row.costUsd) || 0,
            tokens: Number(row.tokens) || 0,
            requests: Number(row.requests) || 0,
          })),
        },
        runnablePipelines: RUNNABLE_PIPELINES,
        advancedRunnableAgents: RUNNABLE_AGENTS,
        runnableAgents: RUNNABLE_AGENTS,
        controlRoom,
      });
    } catch (err) {
      rootLogger.warn({ err }, "[admin/agents/overview] returning empty overview after read failure");
      res.json(emptyAgentsOverview(days, "agents_overview_unavailable"));
    }
  });
}
