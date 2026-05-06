import { Router, type IRouter } from "express";
import { db, agentRunsTable, agentSuggestionsTable, reviewQueueTable, auditLogsTable } from "@workspace/db";
import { eq, desc, and, sql, ilike } from "drizzle-orm";
import { adminKeyMiddleware } from "../lib/admin-middleware.js";

const router: IRouter = Router();

router.use("/admin", adminKeyMiddleware);

router.get("/admin/queue", async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const priority = req.query.priority as string | undefined;
  const entityType = req.query.entity_type as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const conditions = [];
  if (status) conditions.push(eq(reviewQueueTable.queueStatus, status));
  if (priority) conditions.push(eq(reviewQueueTable.priority, priority));

  const rows = await db
    .select({
      queueId: reviewQueueTable.id,
      queueStatus: reviewQueueTable.queueStatus,
      priority: reviewQueueTable.priority,
      assignedTo: reviewQueueTable.assignedTo,
      queueCreatedAt: reviewQueueTable.createdAt,
      queueUpdatedAt: reviewQueueTable.updatedAt,
      suggestionId: agentSuggestionsTable.id,
      entityType: agentSuggestionsTable.entityType,
      entityName: agentSuggestionsTable.entityName,
      confidenceScore: agentSuggestionsTable.confidenceScore,
      suggestionStatus: agentSuggestionsTable.status,
      notes: agentSuggestionsTable.notes,
      suggestionCreatedAt: agentSuggestionsTable.createdAt,
    })
    .from(reviewQueueTable)
    .innerJoin(agentSuggestionsTable, eq(reviewQueueTable.suggestionId, agentSuggestionsTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(reviewQueueTable.createdAt))
    .limit(limit)
    .offset(offset);

  const filtered = entityType
    ? rows.filter((r) => r.entityType === entityType)
    : rows;

  res.json(filtered);
});

router.get("/admin/suggestions", async (req, res): Promise<void> => {
  const status = req.query.status as string | undefined;
  const entityType = req.query.entity_type as string | undefined;
  const search = req.query.search as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const conditions = [];
  if (status) conditions.push(eq(agentSuggestionsTable.status, status));
  if (entityType) conditions.push(eq(agentSuggestionsTable.entityType, entityType));
  if (search) conditions.push(ilike(agentSuggestionsTable.entityName, `%${search}%`));

  const rows = await db
    .select()
    .from(agentSuggestionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentSuggestionsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentSuggestionsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  res.json({ items: rows, total: countResult?.count ?? 0 });
});

router.get("/admin/agent-runs", async (req, res): Promise<void> => {
  const agentName = req.query.agent as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;

  const conditions = [];
  if (agentName) conditions.push(eq(agentRunsTable.agentName, agentName));

  const rows = await db
    .select()
    .from(agentRunsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(agentRunsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

router.get("/admin/suggestions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [suggestion] = await db
    .select()
    .from(agentSuggestionsTable)
    .where(eq(agentSuggestionsTable.id, id));

  if (!suggestion) { res.status(404).json({ error: "Suggerimento non trovato" }); return; }

  let agentRun = null;
  if (suggestion.agentRunId) {
    const [run] = await db.select().from(agentRunsTable).where(eq(agentRunsTable.id, suggestion.agentRunId));
    agentRun = run ?? null;
  }

  const [queueItem] = await db
    .select()
    .from(reviewQueueTable)
    .where(eq(reviewQueueTable.suggestionId, id));

  res.json({ suggestion, agentRun, queueItem: queueItem ?? null });
});

router.post("/admin/suggestions/:id/approve", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [updated] = await db
    .update(agentSuggestionsTable)
    .set({ status: "approved", reviewedBy: "admin", reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(agentSuggestionsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Suggerimento non trovato" }); return; }

  await db
    .update(reviewQueueTable)
    .set({ queueStatus: "approved", updatedAt: new Date() })
    .where(eq(reviewQueueTable.suggestionId, id));

  await db.insert(auditLogsTable).values({
    userId: "admin",
    action: "approve",
    targetType: "suggestion",
    targetId: id,
    metadataJson: { notes: req.body?.notes },
  });

  res.json(updated);
});

router.post("/admin/suggestions/:id/reject", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const notes = req.body?.notes || null;

  const [updated] = await db
    .update(agentSuggestionsTable)
    .set({ status: "rejected", reviewedBy: "admin", reviewedAt: new Date(), notes, updatedAt: new Date() })
    .where(eq(agentSuggestionsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Suggerimento non trovato" }); return; }

  await db
    .update(reviewQueueTable)
    .set({ queueStatus: "rejected", updatedAt: new Date() })
    .where(eq(reviewQueueTable.suggestionId, id));

  await db.insert(auditLogsTable).values({
    userId: "admin",
    action: "reject",
    targetType: "suggestion",
    targetId: id,
    metadataJson: { notes },
  });

  res.json(updated);
});

router.patch("/admin/suggestions/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { entityName, payloadJson, notes, confidenceScore } = req.body || {};
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (entityName !== undefined) updates.entityName = entityName;
  if (payloadJson !== undefined) updates.payloadJson = payloadJson;
  if (notes !== undefined) updates.notes = notes;
  if (confidenceScore !== undefined) updates.confidenceScore = confidenceScore;

  const [updated] = await db
    .update(agentSuggestionsTable)
    .set(updates)
    .where(eq(agentSuggestionsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Suggerimento non trovato" }); return; }

  await db.insert(auditLogsTable).values({
    userId: "admin",
    action: "edit",
    targetType: "suggestion",
    targetId: id,
    metadataJson: { fields: Object.keys(updates).filter((k) => k !== "updatedAt") },
  });

  res.json(updated);
});

router.post("/admin/suggestions/:id/archive", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [updated] = await db
    .update(agentSuggestionsTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(agentSuggestionsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Suggerimento non trovato" }); return; }

  await db
    .update(reviewQueueTable)
    .set({ queueStatus: "archived", updatedAt: new Date() })
    .where(eq(reviewQueueTable.suggestionId, id));

  await db.insert(auditLogsTable).values({
    userId: "admin",
    action: "archive",
    targetType: "suggestion",
    targetId: id,
  });

  res.json(updated);
});

router.get("/admin/logs", async (req, res): Promise<void> => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const action = req.query.action as string | undefined;

  const conditions = [];
  if (action) conditions.push(eq(auditLogsTable.action, action));

  const rows = await db
    .select()
    .from(auditLogsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLogsTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

router.get("/admin/stats", async (_req, res): Promise<void> => {
  const [pending] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentSuggestionsTable)
    .where(eq(agentSuggestionsTable.status, "pending_review"));

  const [approved] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentSuggestionsTable)
    .where(eq(agentSuggestionsTable.status, "approved"));

  const [rejected] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentSuggestionsTable)
    .where(eq(agentSuggestionsTable.status, "rejected"));

  const [archived] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentSuggestionsTable)
    .where(eq(agentSuggestionsTable.status, "archived"));

  const [totalRuns] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(agentRunsTable);

  res.json({
    pending: pending?.count ?? 0,
    approved: approved?.count ?? 0,
    rejected: rejected?.count ?? 0,
    archived: archived?.count ?? 0,
    totalRuns: totalRuns?.count ?? 0,
  });
});

export default router;
