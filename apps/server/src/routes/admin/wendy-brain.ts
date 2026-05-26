import { Router, type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, wendyBrainNodesTable } from "@workspace/db";
import { promoteWendyBrainCandidate, searchWendyBrain } from "@workspace/ai-server";
import { getGraphifyStatus } from "../../lib/graphify-client";

const router = Router();

const SearchSchema = z.object({
  q: z.string().min(1).max(500),
  includeCandidates: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
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
