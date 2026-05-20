import { Router, type Request, type Response } from "express";
import {
  affiliationLeadsTable,
  agentRunsTable,
  agentSuggestionsTable,
  auditLogsTable,
  auditLogTable,
  calendarEventsTable,
  contactMessagesTable,
  db,
  growthArticlesTable,
  reviewQueueTable,
  testSessionsTable,
  usersTable,
} from "@workspace/db";
import { and, desc, eq, gte, ilike, isNull, sql, type SQL } from "drizzle-orm";
import { writeAuditLog } from "../../middleware/audit";
import { rootLogger } from "../../middleware/logger";
import { executionMonitor } from "../../lib/execution-monitor";
import { getRequestBody } from "../../lib/request-context";
import { asPlainRecord, isOneOf } from "../../lib/type-guards";

const router = Router();
const AGENT_SUGGESTION_STATUSES = [
  "pending_review",
  "approved",
  "rejected",
  "applied",
  "archived",
] as const;

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

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
      db.select({ total: sql<number>`count(*)::int` }).from(testSessionsTable),
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
          errorRate > 20 ? "critical" : errorRate >= 5 ? "degraded" : "healthy",
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

router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [suggestionStats, runStats] = await Promise.all([
      db
        .select({
          status: agentSuggestionsTable.status,
          count: sql<number>`count(*)::int`,
        })
        .from(agentSuggestionsTable)
        .groupBy(agentSuggestionsTable.status),
      db.select({ totalRuns: sql<number>`count(*)::int` }).from(agentRunsTable),
    ]);

    const byStatus = Object.fromEntries(
      suggestionStats.map((row) => [row.status, Number(row.count) || 0]),
    );

    res.json({
      pending: byStatus.pending_review ?? 0,
      approved: byStatus.approved ?? 0,
      rejected: byStatus.rejected ?? 0,
      applied: byStatus.applied ?? 0,
      archived: byStatus.archived ?? 0,
      totalRuns: runStats[0]?.totalRuns ?? 0,
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/stats] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const limit = getLimit(req);
    const status = typeof req.query.status === "string" ? req.query.status : "";
    const entityType =
      typeof req.query.entity_type === "string" ? req.query.entity_type : "";
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";
    const confidenceMin = Number(req.query.confidence_min);

    const conditions: SQL[] = [];
    if (
      status &&
      status !== "all" &&
      isOneOf(status, AGENT_SUGGESTION_STATUSES)
    ) {
      conditions.push(eq(agentSuggestionsTable.status, status));
    }
    if (entityType && entityType !== "all")
      conditions.push(eq(agentSuggestionsTable.entityType, entityType));
    if (search)
      conditions.push(ilike(agentSuggestionsTable.entityName, `%${search}%`));
    if (Number.isFinite(confidenceMin) && confidenceMin > 0) {
      conditions.push(
        sql`${agentSuggestionsTable.confidenceScore} >= ${confidenceMin}`,
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const items = await db
      .select({
        id: agentSuggestionsTable.id,
        agentRunId: agentSuggestionsTable.agentRunId,
        entityType: agentSuggestionsTable.entityType,
        entityName: agentSuggestionsTable.entityName,
        payloadJson: agentSuggestionsTable.payloadJson,
        confidenceScore: agentSuggestionsTable.confidenceScore,
        status: agentSuggestionsTable.status,
        reviewedBy: agentSuggestionsTable.reviewedBy,
        reviewedAt: agentSuggestionsTable.reviewedAt,
        notes: agentSuggestionsTable.notes,
        createdAt: agentSuggestionsTable.createdAt,
        updatedAt: agentSuggestionsTable.updatedAt,
        agentName: agentRunsTable.agentName,
        queuePriority: reviewQueueTable.priority,
        queueStatus: reviewQueueTable.queueStatus,
      })
      .from(agentSuggestionsTable)
      .leftJoin(
        agentRunsTable,
        eq(agentSuggestionsTable.agentRunId, agentRunsTable.id),
      )
      .leftJoin(
        reviewQueueTable,
        eq(reviewQueueTable.suggestionId, agentSuggestionsTable.id),
      )
      .where(where)
      .orderBy(desc(agentSuggestionsTable.createdAt))
      .limit(limit);

    const [{ total } = { total: 0 }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(agentSuggestionsTable)
      .where(where);

    res.json({ items, total });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/suggestions/:id", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [suggestion] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!suggestion) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    const [agentRun] = suggestion.agentRunId
      ? await db
          .select()
          .from(agentRunsTable)
          .where(eq(agentRunsTable.id, suggestion.agentRunId))
          .limit(1)
      : [null];
    const [queueItem] = await db
      .select()
      .from(reviewQueueTable)
      .where(eq(reviewQueueTable.suggestionId, id))
      .limit(1);
    const auditTrail = await db
      .select()
      .from(auditLogTable)
      .where(
        and(
          eq(auditLogTable.targetId, id),
          sql`${auditLogTable.action} like 'admin_suggestion_%'`,
        ),
      )
      .orderBy(desc(auditLogTable.createdAt))
      .limit(20);

    res.json({
      suggestion,
      agentRun: agentRun ?? null,
      queueItem: queueItem ?? null,
      auditTrail: auditTrail.map((log) => ({
        id: log.id,
        actorId: log.actorId,
        action: log.action,
        category: log.category,
        metadata: log.metadata,
        createdAt: log.createdAt,
      })),
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/:id] error");
    res.status(500).json({ error: String(err) });
  }
});

async function reviewSuggestion(
  req: Request,
  res: Response,
  status: "approved" | "rejected" | "archived",
  notes?: string,
) {
  try {
    const id = Number(req.params.id);
    const [current] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    const [suggestion] = await db
      .update(agentSuggestionsTable)
      .set({
        status,
        notes: notes ?? null,
        reviewedBy: req.user?.email ?? req.user?.name ?? "admin",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSuggestionsTable.id, id))
      .returning();

    if (!suggestion) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    await db
      .update(reviewQueueTable)
      .set({
        queueStatus: status === "archived" ? "done" : "done",
        updatedAt: new Date(),
      })
      .where(eq(reviewQueueTable.suggestionId, id));

    await writeAuditLog(req, {
      action:
        status === "approved"
          ? "admin_suggestion_approved"
          : status === "rejected"
            ? "admin_suggestion_rejected"
            : "admin_suggestion_archived",
      category: "admin_action",
      targetId: id,
      metadata: {
        entityType: current.entityType,
        entityName: current.entityName,
        previousStatus: current.status,
        newStatus: status,
        notes: notes ?? null,
        confidenceScore: current.confidenceScore,
      },
    });

    res.json({ ok: true, suggestion });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/review] error");
    res.status(500).json({ error: String(err) });
  }
}

router.post("/suggestions/:id/approve", async (req: Request, res: Response) => {
  await reviewSuggestion(req, res, "approved");
});

router.post("/suggestions/:id/reject", async (req: Request, res: Response) => {
  const body = asPlainRecord(getRequestBody(req));
  await reviewSuggestion(
    req,
    res,
    "rejected",
    typeof body.notes === "string" ? body.notes : undefined,
  );
});

router.post("/suggestions/:id/archive", async (req: Request, res: Response) => {
  const body = asPlainRecord(getRequestBody(req));
  await reviewSuggestion(
    req,
    res,
    "archived",
    typeof body.notes === "string" ? body.notes : "Archiviato",
  );
});

router.post("/suggestions/:id/apply", async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const body = asPlainRecord(getRequestBody(req));
    const notes = typeof body.notes === "string" ? body.notes : undefined;
    const [current] = await db
      .select()
      .from(agentSuggestionsTable)
      .where(eq(agentSuggestionsTable.id, id))
      .limit(1);

    if (!current) {
      res.status(404).json({ error: "Suggestion not found" });
      return;
    }

    if (current.status !== "approved") {
      res.status(400).json({
        error: "Solo i suggerimenti approvati possono essere applicati",
      });
      return;
    }

    const [suggestion] = await db
      .update(agentSuggestionsTable)
      .set({
        status: "applied",
        notes: notes ?? current.notes,
        reviewedBy: req.user?.email ?? req.user?.name ?? "admin",
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentSuggestionsTable.id, id))
      .returning();

    await writeAuditLog(req, {
      action: "admin_suggestion_applied",
      category: "admin_action",
      targetId: id,
      metadata: {
        entityType: current.entityType,
        entityName: current.entityName,
        previousStatus: current.status,
        newStatus: "applied",
        notes: notes ?? null,
        confidenceScore: current.confidenceScore,
        workflowOnly: true,
      },
    });

    res.json({ ok: true, suggestion });
  } catch (err) {
    rootLogger.error({ err }, "[admin/suggestions/apply] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/agent-runs", async (req: Request, res: Response) => {
  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(getLimit(req));
    res.json(runs);
  } catch (err) {
    rootLogger.error({ err }, "[admin/agent-runs] error");
    res.status(500).json({ error: String(err) });
  }
});

router.get("/logs", async (req: Request, res: Response) => {
  try {
    const canonical = await db
      .select()
      .from(auditLogTable)
      .orderBy(desc(auditLogTable.createdAt))
      .limit(getLimit(req));

    res.json(
      canonical.map((log) => ({
        id: log.id,
        userId: log.actorId == null ? null : String(log.actorId),
        action: log.action,
        targetType: log.category ?? "system",
        targetId: log.targetId,
        metadataJson: (log.metadata as Record<string, unknown> | null) ?? null,
        createdAt: log.createdAt,
      })),
    );
  } catch {
    try {
      const legacy = await db
        .select()
        .from(auditLogsTable)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(getLimit(req));
      res.json(legacy);
    } catch (err) {
      rootLogger.error({ err }, "[admin/logs] error");
      res.status(500).json({ error: String(err) });
    }
  }
});

export default router;
