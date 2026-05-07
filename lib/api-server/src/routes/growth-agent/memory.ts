/**
 * GET /api/growth-agent/memory
 *
 * Returns the full persistent memory for the authenticated user:
 *   - facts:    biographical facts (key/value pairs)
 *   - patterns: behavioral patterns with confidence score
 *
 * Both are sorted by updatedAt DESC so the UI shows the most
 * recently observed information first.
 *
 * Protected by JWT middleware (userId comes from req.user.id).
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { coachMemoryFactsTable, coachMemoryPatternsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  const userId: number = (req as any).user.id;

  try {
    const [facts, patterns] = await Promise.all([
      db
        .select()
        .from(coachMemoryFactsTable)
        .where(eq(coachMemoryFactsTable.userId, userId))
        .orderBy(desc(coachMemoryFactsTable.updatedAt)),

      db
        .select()
        .from(coachMemoryPatternsTable)
        .where(eq(coachMemoryPatternsTable.userId, userId))
        .orderBy(desc(coachMemoryPatternsTable.confidence)),
    ]);

    res.json({ facts, patterns });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
