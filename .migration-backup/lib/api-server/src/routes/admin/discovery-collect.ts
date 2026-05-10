/**
 * POST /api/admin/discovery/collect
 * ────────────────────────────────────
 * Admin-only endpoint to manually trigger a collector + enricher run.
 * Protected by adminOnly middleware.
 * Useful for:
 *   - Testing the collector in development
 *   - Forcing a refresh before a demo
 *   - Backfilling enrichment on existing items
 *
 * Query params:
 *   ?enrich_only=1  — skip collector, only run enricher
 *   ?collect_only=1 — skip enricher
 */
import { Router, Request, Response } from "express";
import { adminOnly } from "../../middleware/adminOnly";
import { runCollector } from "@workspace/integrations-openai-ai-server/discovery-agent/collector-agent";
import { runEnricher } from "@workspace/integrations-openai-ai-server/discovery-agent/enricher-agent";

const router = Router();

router.post("/", adminOnly, async (req: Request, res: Response): Promise<void> => {
  const enrichOnly  = req.query["enrich_only"]  === "1";
  const collectOnly = req.query["collect_only"] === "1";

  try {
    let collectorResult = null;
    let enricherResult  = null;

    if (!enrichOnly) {
      collectorResult = await runCollector();
      console.log("[admin/discovery] collector done:", collectorResult);
    }

    if (!collectOnly) {
      enricherResult = await runEnricher(50); // larger batch for manual runs
      console.log("[admin/discovery] enricher done:", enricherResult);
    }

    res.json({
      ok: true,
      collector: collectorResult,
      enricher:  enricherResult,
    });
  } catch (err) {
    console.error("[admin/discovery] collect failed:", err);
    res.status(500).json({ error: String(err) });
  }
});

export default router;
