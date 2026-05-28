import { Router, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, wendyBrainNodesTable, wendyNeuralActivationsTable, wendyNeuralEdgesTable } from "@workspace/db";
import { promoteWendyBrainCandidate, searchWendyBrain } from "@workspace/ai-server";
import { getGraphifyStatus } from "../../lib/graphify-client";

const router = Router();

const SearchSchema = z.object({
  q: z.string().min(1).max(500),
  includeCandidates: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

const NeuralLimitSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const NeuralActivationSchema = z.object({
  requestId: z.string().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const NeuralEdgesSchema = z.object({
  status: z.enum(["candidate", "active", "archived"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

router.get("/wendy-brain/candidates", async (_req: Request, res: Response) => {
  const rows = await db
    .select()
    .from(wendyBrainNodesTable)
    .where(eq(wendyBrainNodesTable.status, "candidate"))
    .orderBy(desc(wendyBrainNodesTable.importance), desc(wendyBrainNodesTable.createdAt))
    .limit(100);

  res.json({ candidates: rows });
});

router.get("/wendy-brain/search", async (req: Request, res: Response) => {
  const parsed = SearchSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query non valida", details: parsed.error.flatten() });
    return;
  }

  const options: Parameters<typeof searchWendyBrain>[1] = {};
  if (parsed.data.includeCandidates !== undefined) options.includeCandidates = parsed.data.includeCandidates;
  if (parsed.data.limit !== undefined) options.limit = parsed.data.limit;
  const results = await searchWendyBrain(parsed.data.q, options);
  res.json({ results });
});

router.get("/wendy-brain/neural/activations", async (req: Request, res: Response) => {
  const parsed = NeuralActivationSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query non valida", details: parsed.error.flatten() });
    return;
  }
  const limit = parsed.data.limit ?? 100;
  const query = db.select().from(wendyNeuralActivationsTable);
  const rows = parsed.data.requestId
    ? await query
      .where(eq(wendyNeuralActivationsTable.requestId, parsed.data.requestId))
      .orderBy(desc(wendyNeuralActivationsTable.score))
      .limit(limit)
    : await query
      .orderBy(desc(wendyNeuralActivationsTable.createdAt))
      .limit(limit);
  res.json({ activations: rows });
});

router.get("/wendy-brain/neural/recent", async (req: Request, res: Response) => {
  const parsed = NeuralLimitSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query non valida", details: parsed.error.flatten() });
    return;
  }
  const rows = await db
    .select()
    .from(wendyNeuralActivationsTable)
    .orderBy(desc(wendyNeuralActivationsTable.createdAt))
    .limit(parsed.data.limit ?? 50);
  res.json({ activations: rows });
});

router.get("/wendy-brain/neural/edges", async (req: Request, res: Response) => {
  const parsed = NeuralEdgesSchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Query non valida", details: parsed.error.flatten() });
    return;
  }
  const limit = parsed.data.limit ?? 100;
  const query = db.select().from(wendyNeuralEdgesTable);
  const rows = parsed.data.status
    ? await query
      .where(eq(wendyNeuralEdgesTable.status, parsed.data.status))
      .orderBy(desc(wendyNeuralEdgesTable.weight), desc(wendyNeuralEdgesTable.lastReinforcedAt))
      .limit(limit)
    : await query
      .orderBy(desc(wendyNeuralEdgesTable.weight), desc(wendyNeuralEdgesTable.lastReinforcedAt))
      .limit(limit);
  res.json({ edges: rows });
});

async function setNeuralEdgeStatus(req: Request, res: Response, status: "active" | "archived") {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  await db
    .update(wendyNeuralEdgesTable)
    .set({ status, updatedAt: new Date() })
    .where(eq(wendyNeuralEdgesTable.id, id));
  res.json({ ok: true, id, status });
}

router.post("/wendy-brain/neural/edges/:id/approve", async (req: Request, res: Response) => {
  await setNeuralEdgeStatus(req, res, "active");
});

router.post("/wendy-brain/neural/edges/:id/reject", async (req: Request, res: Response) => {
  await setNeuralEdgeStatus(req, res, "archived");
});

router.post("/wendy-brain/:id/approve", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  await promoteWendyBrainCandidate(id, req.user!.id);
  res.json({ ok: true, id, status: "active" });
});

router.post("/wendy-brain/:id/reject", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  await db
    .update(wendyBrainNodesTable)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(wendyBrainNodesTable.id, id));
  res.json({ ok: true, id, status: "archived" });
});

router.get("/wendy-brain/graphify/status", async (_req: Request, res: Response) => {
  res.json(await getGraphifyStatus());
});

export default router;
