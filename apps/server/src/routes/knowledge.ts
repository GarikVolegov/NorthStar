import { Router, type Request, type Response } from "express";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod/v4";
import { db, knowledgeNodesTable, knowledgeEdgesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { suggestAutoLinks, autoCategorize, suggestMissingNodes } from "@workspace/ai-server";

const router = Router();

const createNodeSchema = z.object({
  type: z.string().min(1).max(32).optional(),
  title: z.string().min(1).max(200),
  content: z.string().default(""),
  color: z.string().max(16).optional(),
  url: z.string().optional(),
  sectorId: z.number().optional(),
});

const updateNodeSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  color: z.string().max(16).optional(),
  url: z.string().optional(),
  type: z.string().max(32).optional(),
});

const createEdgeSchema = z.object({
  sourceId: z.number(),
  targetId: z.number(),
  label: z.string().max(100).optional(),
});

// ── GET graph ────────────────────────────────────────────────
router.get("/graph", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const nodes = await db
    .select()
    .from(knowledgeNodesTable)
    .where(eq(knowledgeNodesTable.userId, userId));

  const edges = await db
    .select()
    .from(knowledgeEdgesTable)
    .where(eq(knowledgeEdgesTable.userId, userId));

  res.json({ nodes, edges });
});

// ── CREATE node ──────────────────────────────────────────────
router.post("/nodes", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const data = createNodeSchema.parse(req.body);

  let nodeType = data.type;
  if (!nodeType) {
    nodeType = await autoCategorize(data.title, data.content);
  }

  const [node] = await db
    .insert(knowledgeNodesTable)
    .values({
      userId,
      type: nodeType,
      title: data.title,
      content: data.content,
      color: data.color ?? null,
      url: data.url ?? null,
      sectorId: data.sectorId ?? null,
    })
    .returning();

  res.status(201).json(node);
});

// ── UPDATE node ──────────────────────────────────────────────
router.patch("/nodes/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);
  const data = updateNodeSchema.parse(req.body);

  const [existing] = await db
    .select()
    .from(knowledgeNodesTable)
    .where(and(eq(knowledgeNodesTable.id, id), eq(knowledgeNodesTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Nodo non trovato" });
    return;
  }

  const [updated] = await db
    .update(knowledgeNodesTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(knowledgeNodesTable.id, id))
    .returning();

  res.json(updated);
});

// ── DELETE node ──────────────────────────────────────────────
router.delete("/nodes/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [existing] = await db
    .select()
    .from(knowledgeNodesTable)
    .where(and(eq(knowledgeNodesTable.id, id), eq(knowledgeNodesTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Nodo non trovato" });
    return;
  }

  await db.delete(knowledgeEdgesTable).where(
    and(eq(knowledgeEdgesTable.sourceId, id), eq(knowledgeEdgesTable.userId, userId)),
  );
  await db.delete(knowledgeEdgesTable).where(
    and(eq(knowledgeEdgesTable.targetId, id), eq(knowledgeEdgesTable.userId, userId)),
  );
  await db.delete(knowledgeNodesTable).where(eq(knowledgeNodesTable.id, id));

  res.status(204).send();
});

// ── BATCH save positions ─────────────────────────────────────
router.post("/nodes/positions", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const positions = z.array(z.object({ id: z.number(), x: z.number(), y: z.number() })).parse(req.body);

  for (const pos of positions) {
    await db
      .update(knowledgeNodesTable)
      .set({ x: pos.x, y: pos.y, updatedAt: new Date() })
      .where(and(eq(knowledgeNodesTable.id, pos.id), eq(knowledgeNodesTable.userId, userId)));
  }

  res.json({ saved: positions.length });
});

// ── Auto-link suggestions (ML) ──────────────────────────────
router.post("/nodes/:id/auto-link", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [source] = await db
    .select()
    .from(knowledgeNodesTable)
    .where(and(eq(knowledgeNodesTable.id, id), eq(knowledgeNodesTable.userId, userId)))
    .limit(1);

  if (!source) {
    res.status(404).json({ error: "Nodo non trovato" });
    return;
  }

  const existingEdgeIds = new Set<number>();
  const existingEdges = await db
    .select()
    .from(knowledgeEdgesTable)
    .where(eq(knowledgeEdgesTable.userId, userId));

  for (const edge of existingEdges) {
    if (edge.sourceId === id) existingEdgeIds.add(edge.targetId);
    if (edge.targetId === id) existingEdgeIds.add(edge.sourceId);
  }

  const candidates = await db
    .select({ id: knowledgeNodesTable.id, title: knowledgeNodesTable.title, content: knowledgeNodesTable.content, type: knowledgeNodesTable.type })
    .from(knowledgeNodesTable)
    .where(and(
      eq(knowledgeNodesTable.userId, userId),
      ne(knowledgeNodesTable.id, id),
    ));

  const filteredCandidates = candidates.filter((c) => !existingEdgeIds.has(c.id));

  const suggestions = await suggestAutoLinks(
    { id: source.id, title: source.title, content: source.content ?? "", type: source.type },
    filteredCandidates.map((c) => ({ id: c.id, title: c.title, content: c.content ?? "", type: c.type })),
    5,
  );

  res.json({ suggestions });
});

// ── Suggest missing nodes (ML) ──────────────────────────────
router.get("/suggestions", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const existingNodes = await db
    .select({ title: knowledgeNodesTable.title, type: knowledgeNodesTable.type, content: knowledgeNodesTable.content })
    .from(knowledgeNodesTable)
    .where(eq(knowledgeNodesTable.userId, userId))
    .limit(50);

  const suggestions = await suggestMissingNodes(
    existingNodes.map((n) => ({ title: n.title, type: n.type, content: n.content ?? "" })),
  );

  res.json({ suggestions });
});

// ── CREATE edge ──────────────────────────────────────────────
router.post("/edges", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const data = createEdgeSchema.parse(req.body);

  const [edge] = await db
    .insert(knowledgeEdgesTable)
    .values({
      userId,
      sourceId: data.sourceId,
      targetId: data.targetId,
      label: data.label ?? null,
    })
    .returning();

  res.status(201).json(edge);
});

// ── UPDATE edge ──────────────────────────────────────────────
router.patch("/edges/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);
  const data = z.object({ label: z.string().max(100).optional() }).parse(req.body);

  const [existing] = await db
    .select()
    .from(knowledgeEdgesTable)
    .where(and(eq(knowledgeEdgesTable.id, id), eq(knowledgeEdgesTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Arco non trovato" });
    return;
  }

  const [updated] = await db
    .update(knowledgeEdgesTable)
    .set(data)
    .where(eq(knowledgeEdgesTable.id, id))
    .returning();

  res.json(updated);
});

// ── DELETE edge ──────────────────────────────────────────────
router.delete("/edges/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id);

  const [existing] = await db
    .select()
    .from(knowledgeEdgesTable)
    .where(and(eq(knowledgeEdgesTable.id, id), eq(knowledgeEdgesTable.userId, userId)))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Arco non trovato" });
    return;
  }

  await db.delete(knowledgeEdgesTable).where(eq(knowledgeEdgesTable.id, id));
  res.status(204).send();
});

// ── Chat with knowledge graph (SSE streaming) ───────────────
router.post("/ask", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const data = z.object({ message: z.string().min(1).max(5000) }).parse(req.body);
  const log = req.log;

  const userNodes = await db
    .select({ title: knowledgeNodesTable.title, content: knowledgeNodesTable.content, type: knowledgeNodesTable.type })
    .from(knowledgeNodesTable)
    .where(eq(knowledgeNodesTable.userId, userId))
    .limit(20);

  const contextStr = userNodes.length > 0
    ? `\n\n## Il tuo grafo della conoscenza\n${userNodes.map((n) => `- [${n.type}] ${n.title}: ${(n.content ?? "").slice(0, 200)}`).join("\n")}`
    : "";

  const systemContent = `Sei un assistente che analizza il grafo della conoscenza personale dell'utente.
Rispondi in modo chiaro e utile, basandoti sui nodi del grafo. Se non trovi informazioni rilevanti, dillo.${contextStr}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const { getLLM } = await import("@workspace/ai-server/llm/client");
    const llm = getLLM();
    const stream = await llm.chat(
      [
        { role: "system" as const, content: systemContent },
        { role: "user" as const, content: data.message },
      ],
      { model: "gpt-4o-mini", temperature: 0.65, maxTokens: 600 },
    );

    for await (const delta of stream) {
      res.write(`data: ${JSON.stringify({ type: "token", value: delta })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err) {
    log.error({ err }, "knowledge chat error");
    res.write(`data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione" })}\n\n`);
    res.end();
  }
});

export default router;
