import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, knowledgeNodesTable, knowledgeEdgesTable } from "@workspace/db";
import { authMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();

const NODE_TYPES = [
  "note",
  "skill",
  "document",
  "sector",
  "role",
  "tool",
  "certification",
  "concept",
  "link",
] as const;

const CreateNodeBody = z.object({
  type: z.enum(NODE_TYPES).default("note"),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(20_000).optional(),
  color: z.string().max(16).optional(),
  url: z.string().max(2000).optional(),
  sectorId: z.number().int().positive().nullable().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
});

const UpdateNodeBody = z.object({
  type: z.enum(NODE_TYPES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(20_000).optional(),
  color: z.string().max(16).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  sectorId: z.number().int().positive().nullable().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
});

const CreateEdgeBody = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
  label: z.string().max(100).optional(),
});

const BulkPositionsBody = z.object({
  positions: z
    .array(
      z.object({
        id: z.number().int().positive(),
        x: z.number().finite(),
        y: z.number().finite(),
      }),
    )
    .min(1)
    .max(500),
});

router.get("/knowledge/graph", authMiddleware, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const [nodes, edges] = await Promise.all([
    db.select().from(knowledgeNodesTable).where(eq(knowledgeNodesTable.userId, userId)),
    db.select().from(knowledgeEdgesTable).where(eq(knowledgeEdgesTable.userId, userId)),
  ]);
  res.json({ nodes, edges });
});

router.post("/knowledge/nodes", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = CreateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const v = parsed.data;
  const [created] = await db
    .insert(knowledgeNodesTable)
    .values({
      userId,
      type: v.type,
      title: v.title,
      content: v.content ?? "",
      color: v.color ?? null,
      url: v.url ?? null,
      sectorId: v.sectorId ?? null,
      x: v.x ?? 0,
      y: v.y ?? 0,
    })
    .returning();
  res.status(201).json(created);
});

router.patch("/knowledge/nodes/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const parsed = UpdateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }
  const [updated] = await db
    .update(knowledgeNodesTable)
    .set(updates)
    .where(and(eq(knowledgeNodesTable.id, id), eq(knowledgeNodesTable.userId, userId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Nodo non trovato" });
    return;
  }
  res.json(updated);
});

router.post("/knowledge/nodes/positions", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = BulkPositionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const now = new Date();
  // Sequential is fine — this is a tiny batch; transactional would be nicer
  // but Drizzle requires manual case-when for true batching.
  await Promise.all(
    parsed.data.positions.map((p) =>
      db
        .update(knowledgeNodesTable)
        .set({ x: p.x, y: p.y, updatedAt: now })
        .where(and(eq(knowledgeNodesTable.id, p.id), eq(knowledgeNodesTable.userId, userId))),
    ),
  );
  res.json({ ok: true, count: parsed.data.positions.length });
});

router.delete("/knowledge/nodes/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  // Delete edges referencing this node first
  await db
    .delete(knowledgeEdgesTable)
    .where(
      and(
        eq(knowledgeEdgesTable.userId, userId),
        or(eq(knowledgeEdgesTable.sourceId, id), eq(knowledgeEdgesTable.targetId, id)),
      ),
    );
  const [deleted] = await db
    .delete(knowledgeNodesTable)
    .where(and(eq(knowledgeNodesTable.id, id), eq(knowledgeNodesTable.userId, userId)))
    .returning({ id: knowledgeNodesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Nodo non trovato" });
    return;
  }
  res.json({ ok: true });
});

router.post("/knowledge/edges", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = CreateEdgeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const { sourceId, targetId, label } = parsed.data;
  if (sourceId === targetId) {
    res.status(400).json({ error: "Un nodo non può collegarsi a sé stesso" });
    return;
  }
  // Make sure both nodes belong to the user
  const owned = await db
    .select({ id: knowledgeNodesTable.id })
    .from(knowledgeNodesTable)
    .where(
      and(
        eq(knowledgeNodesTable.userId, userId),
        inArray(knowledgeNodesTable.id, [sourceId, targetId]),
      ),
    );
  if (owned.length !== 2) {
    res.status(404).json({ error: "Nodi non trovati" });
    return;
  }
  const [created] = await db
    .insert(knowledgeEdgesTable)
    .values({ userId, sourceId, targetId, label: label ?? null })
    .returning();
  res.status(201).json(created);
});

router.delete("/knowledge/edges/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const [deleted] = await db
    .delete(knowledgeEdgesTable)
    .where(and(eq(knowledgeEdgesTable.id, id), eq(knowledgeEdgesTable.userId, userId)))
    .returning({ id: knowledgeEdgesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Arco non trovato" });
    return;
  }
  res.json({ ok: true });
});

export default router;
