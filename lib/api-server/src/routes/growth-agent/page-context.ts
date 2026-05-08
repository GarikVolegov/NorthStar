/**
 * POST /api/growth-agent/page-context
 *
 * Persists a PageContextSnapshot: records which page the user was on
 * when they clicked "Chiedi a Wendy" and what prompt was generated.
 *
 * Used exclusively for analytics — the AI prompt injection happens
 * client-side via WendyPageContext React context.
 *
 * Body: {
 *   pageId:     string   — stable page identifier (e.g. 'riasec-results')
 *   pageData:   object   — arbitrary JSON snapshot of page state
 *   promptUsed: string?  — the prompt that was pre-filled
 * }
 *
 * Protected by JWT middleware.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { pageContextSnapshotsTable } from "@workspace/db";

const router = Router();

router.post("/", async (req, res) => {
  const userId: number = (req as any).user.id;
  const { pageId, pageData = {}, promptUsed } = req.body as {
    pageId: string;
    pageData?: Record<string, unknown>;
    promptUsed?: string;
  };

  if (!pageId?.trim()) {
    return res.status(400).json({ error: "pageId is required" });
  }

  try {
    const [snapshot] = await db
      .insert(pageContextSnapshotsTable)
      .values({
        userId,
        pageId: pageId.trim(),
        pageData,
        promptUsed: promptUsed?.slice(0, 512),
      })
      .returning({ id: pageContextSnapshotsTable.id });

    res.status(201).json({ ok: true, id: snapshot.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
