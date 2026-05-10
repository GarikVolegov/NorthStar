/**
 * GET  /api/growth-agent/knowledge  — list all ingested sources for the user
 * DELETE /api/growth-agent/knowledge/:id — delete a specific node
 * DELETE /api/growth-agent/knowledge?sourceType=persona_example — bulk delete by type
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { knowledgeNodesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router = Router();

// List sources (grouped by sourceName for UI display)
router.get("/", async (req, res) => {
  const userId: number = (req as any).user.id;

  const nodes = await db
    .select({
      id: knowledgeNodesTable.id,
      nodeType: knowledgeNodesTable.nodeType,
      content: knowledgeNodesTable.content,
      metadata: knowledgeNodesTable.metadata,
    })
    .from(knowledgeNodesTable)
    .where(eq(knowledgeNodesTable.userId, userId))
    .orderBy(knowledgeNodesTable.id);

  // Group by source name for UI
  const grouped: Record<string, { id: number; nodeType: string | null; preview: string }[]> = {};
  for (const n of nodes) {
    const meta = n.metadata as Record<string, unknown> | null;
    const source = (meta?.["source"] as string) ?? "unknown";
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push({
      id: n.id,
      nodeType: n.nodeType,
      preview: (n.content ?? "").slice(0, 120),
    });
  }

  return res.json({ ok: true, sources: grouped, totalChunks: nodes.length });
});

// Delete single node
router.delete("/:id", async (req, res) => {
  const userId: number = (req as any).user.id;
  const id = parseInt(req.params.id, 10);
  await db
    .delete(knowledgeNodesTable)
    .where(and(eq(knowledgeNodesTable.id, id), eq(knowledgeNodesTable.userId, userId)));
  return res.json({ ok: true });
});

// Bulk delete by sourceType
router.delete("/", async (req, res) => {
  const userId: number = (req as any).user.id;
  const { sourceType } = req.query as { sourceType?: string };
  if (!sourceType) return res.status(400).json({ error: "sourceType query param required" });
  await db
    .delete(knowledgeNodesTable)
    .where(
      and(
        eq(knowledgeNodesTable.userId, userId),
        eq(knowledgeNodesTable.nodeType, sourceType),
      ),
    );
  return res.json({ ok: true });
});

export default router;
