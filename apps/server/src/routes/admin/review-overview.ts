import type { Router, Request, Response } from "express";
import {
  affiliationLeadsTable,
  agentRunsTable,
  agentSuggestionsTable,
  calendarEventsTable,
  contactMessagesTable,
  db,
  growthArticlesTable,
  testSessionsTable,
  usersTable,
} from "@workspace/db";
import { desc, gte, isNull, sql } from "drizzle-orm";
import { rootLogger } from "../../middleware/logger";
import { executionMonitor } from "../../lib/execution-monitor";

export function registerReviewOverviewRoute(router: Router) {
  router.get("/overview", async (_req: Request, res: Response) => {
    try {
      const now = new Date();
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const errorReport = executionMonitor.getReport();

      const [
        suggestionStats,
        growthStats,
        inboxStats,
        leadStats,
        userStats,
        testStats,
        calendarStats,
        agentRows,
        failedRuns,
      ] = await Promise.all([
        db
          .select({
            status: agentSuggestionsTable.status,
            count: sql<number>`count(*)::int`,
          })
          .from(agentSuggestionsTable)
          .groupBy(agentSuggestionsTable.status),
        db
          .select({
            status: growthArticlesTable.status,
            count: sql<number>`count(*)::int`,
          })
          .from(growthArticlesTable)
          .groupBy(growthArticlesTable.status),
        db
          .select({
            total: sql<number>`count(*)::int`,
            unread: sql<number>`count(*) filter (where ${contactMessagesTable.read} = false)::int`,
          })
          .from(contactMessagesTable)
          .where(isNull(contactMessagesTable.deletedAt)),
        db
          .select({
            total: sql<number>`count(*)::int`,
            pending: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'pending')::int`,
            contacted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'contacted')::int`,
          })
          .from(affiliationLeadsTable),
        db
          .select({
            total: sql<number>`count(*)::int`,
            premium: sql<number>`count(*) filter (where exists (
              select 1 from subscriptions s
              where s.user_id = ${usersTable.id}
                and s.cancelled_at is null
                and (s.valid_until is null or s.valid_until >= now())
                and s.plan in ('pro', 'team')
            ))::int`,
            new30d: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${since30d})::int`,
          })
          .from(usersTable),
        db
          .select({ total: sql<number>`count(*)::int` })
          .from(testSessionsTable),
        db
          .select({
            upcoming: sql<number>`count(*) filter (where ${calendarEventsTable.endAt} >= ${now})::int`,
            next24h: sql<number>`count(*) filter (where ${calendarEventsTable.startAt} >= ${now} and ${calendarEventsTable.startAt} < ${new Date(Date.now() + 24 * 60 * 60 * 1000)})::int`,
          })
          .from(calendarEventsTable),
        db
          .select({
            agentName: agentRunsTable.agentName,
            totalCalls30d: sql<number>`count(*)::int`,
            errorCount30d: sql<number>`count(*) filter (where ${agentRunsTable.status} in ('failed', 'cancelled'))::int`,
            avgDurationMs: sql<number>`avg(${agentRunsTable.durationMs})::int`,
          })
          .from(agentRunsTable)
          .where(gte(agentRunsTable.startedAt, since30d))
          .groupBy(agentRunsTable.agentName)
          .orderBy(agentRunsTable.agentName),
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
          .where(sql`${agentRunsTable.status} in ('failed', 'cancelled')`)
          .orderBy(desc(agentRunsTable.startedAt))
          .limit(5),
      ]);

      const suggestionByStatus = Object.fromEntries(
        suggestionStats.map((row) => [row.status, Number(row.count) || 0]),
      );
      const growthByStatus = Object.fromEntries(
        growthStats.map((row) => [row.status, Number(row.count) || 0]),
      );
      const pendingReview = suggestionByStatus.pending_review ?? 0;
      const growthPending = growthByStatus.pending ?? growthByStatus.draft ?? 0;
      const unreadMessages = Number(inboxStats[0]?.unread) || 0;
      const pendingLeads = Number(leadStats[0]?.pending) || 0;

      const agents = agentRows.map((row) => {
        const total = Number(row.totalCalls30d) || 0;
        const errors = Number(row.errorCount30d) || 0;
        const errorRate = total > 0 ? Math.round((errors / total) * 100) : 0;
        const successRate =
          total > 0 ? Math.round(((total - errors) / total) * 100) : 100;
        return {
          agentName: row.agentName,
          totalCalls30d: total,
          errorCount30d: errors,
          errorRate30d: errorRate,
          successRate30d: successRate,
          avgDurationMs: row.avgDurationMs ?? null,
          status:
            errorRate > 20
              ? "critical"
              : errorRate >= 5
                ? "degraded"
                : "healthy",
        };
      });

      const criticalAgents = agents.filter(
        (agent) => agent.status === "critical",
      );
      const degradedAgents = agents.filter(
        (agent) => agent.status === "degraded",
      );
      const actionItems =
        pendingReview + growthPending + unreadMessages + pendingLeads;
      const reasons: string[] = [];
      if (pendingReview > 0)
        reasons.push(`${pendingReview} richieste in revisione`);
      if (growthPending > 0)
        reasons.push(`${growthPending} articoli crescita pending`);
      if (unreadMessages > 0)
        reasons.push(`${unreadMessages} messaggi non letti`);
      if (pendingLeads > 0) reasons.push(`${pendingLeads} lead da contattare`);
      if (criticalAgents.length > 0)
        reasons.push(`${criticalAgents.length} agenti critici`);
      if (degradedAgents.length > 0)
        reasons.push(`${degradedAgents.length} agenti degradati`);
      if (errorReport.totalCaptured > 0)
        reasons.push(`${errorReport.totalCaptured} errori catturati`);

      const healthStatus =
        criticalAgents.length > 0 || errorReport.errors.length >= 5
          ? "critical"
          : reasons.length > 0
            ? "attention"
            : "healthy";

      res.json({
        generatedAt: new Date().toISOString(),
        health: {
          status: healthStatus,
          label:
            healthStatus === "healthy"
              ? "Tutto stabile"
              : healthStatus === "attention"
                ? "Attenzione"
                : "Intervento richiesto",
          reasons,
          criticalCount:
            criticalAgents.length + (errorReport.errors.length >= 5 ? 1 : 0),
          actionItems,
        },
        queues: {
          reviewPending: pendingReview,
          growthPending,
          totalOpen: pendingReview + growthPending,
        },
        errors: {
          totalCaptured: errorReport.totalCaptured,
          unique: errorReport.errors.length,
          brokenComponents: errorReport.brokenComponents.slice(0, 5),
          recent: errorReport.errors.slice(0, 5).map((error) => ({
            file: error.file,
            function: error.function,
            message: error.message,
            code: error.code ?? null,
            capturedAt: error.capturedAt,
            occurrences: error.occurrences,
          })),
        },
        agents: {
          total: agents.length,
          critical: criticalAgents.length,
          degraded: degradedAgents.length,
          failedRecent: failedRuns.map((run) => ({
            id: run.id,
            agentName: run.agentName,
            taskType: run.taskType,
            startedAt: run.startedAt,
            durationMs: run.durationMs,
            errorMessage: run.errorMessage,
            status: run.status,
          })),
          health: agents,
        },
        metrics: {
          users: userStats[0] ?? { total: 0, premium: 0, new30d: 0 },
          tests: testStats[0] ?? { total: 0 },
          calendar: calendarStats[0] ?? { upcoming: 0, next24h: 0 },
        },
        inbox: {
          unreadMessages,
          pendingLeads,
          contactedLeads: Number(leadStats[0]?.contacted) || 0,
          totalMessages: Number(inboxStats[0]?.total) || 0,
          totalLeads: Number(leadStats[0]?.total) || 0,
        },
      });
    } catch (err) {
      rootLogger.error({ err }, "[admin/overview] error");
      res.status(500).json({ error: String(err) });
    }
  });
}
