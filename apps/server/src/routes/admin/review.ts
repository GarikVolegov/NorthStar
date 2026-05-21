import { Router, type Request, type Response } from "express";
import {
  agentRunsTable,
  agentSuggestionsTable,
  auditLogsTable,
  auditLogTable,
  db,
  reviewQueueTable,
} from "@workspace/db";
import { and, desc, eq, ilike, sql, type SQL } from "drizzle-orm";
import { writeAuditLog } from "../../middleware/audit";
import { rootLogger } from "../../middleware/logger";
import { getRequestBody } from "../../lib/request-context";
import { asPlainRecord, isOneOf } from "../../lib/type-guards";
import { registerReviewOverviewRoute } from "./review-overview";

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

registerReviewOverviewRoute(router);

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
