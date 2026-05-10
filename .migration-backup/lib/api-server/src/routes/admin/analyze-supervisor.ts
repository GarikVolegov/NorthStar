/**
 * POST /api/admin/analyze-supervisor
 * ────────────────────────────────────
 * Triggers the weekly SupervisorAgent pattern analysis on-demand.
 * Protected by the adminOnly middleware (x-admin-secret header).
 *
 * REQUEST
 *   POST /api/admin/analyze-supervisor
 *   Headers:
 *     Authorization: Bearer <jwt>          ← required by global jwtMiddleware
 *     x-admin-secret: <ADMIN_SECRET>       ← required by adminOnly
 *   Body: (none)
 *
 * RESPONSE 200 — analysis ran successfully
 *   {
 *     ok: true,
 *     totalRewrites: 42,
 *     analyzedAt: "2026-05-07T12:00:00.000Z",
 *     newPlatitudePatterns: ["pattern1", ...],
 *     newActionPatterns:    ["pattern2", ...],
 *     dominantReasons:      ["reason1", ...]
 *   }
 *
 * RESPONSE 200 — no data to analyze
 *   { ok: true, message: "No rewrite logs in the last 7 days" }
 *
 * RESPONSE 500 — analysis job threw
 *   { ok: false, error: "<message>" }
 *
 * NOTE: The job is NOT async-background here — it awaits the result so
 * the caller gets the proposal immediately. Typical runtime: 2-4 seconds
 * (one GPT-4o-mini call). If you prefer fire-and-forget, add ?async=1 param.
 */
import { Router, Request, Response } from "express";
import { adminOnly } from "../../middleware/adminOnly";
import { runPatternAnalysis } from "../../../../integrations-openai-ai-server/src/growth-agent/supervisor-pattern-analyzer";

const router = Router();

router.post("/", adminOnly, async (req: Request, res: Response): Promise<void> => {
  const asyncMode = req.query["async"] === "1";

  if (asyncMode) {
    // Fire-and-forget: respond immediately, run in background
    res.json({ ok: true, message: "Analysis started in background" });
    runPatternAnalysis().catch((err: unknown) =>
      console.error("[analyze-supervisor] background job failed:", err)
    );
    return;
  }

  // Synchronous mode: wait for result
  try {
    const proposal = await runPatternAnalysis();

    if (!proposal) {
      res.json({ ok: true, message: "No rewrite logs in the last 7 days" });
      return;
    }

    res.json({
      ok:                   true,
      totalRewrites:        proposal.totalRewrites,
      analyzedAt:           proposal.analyzedAt,
      newPlatitudePatterns: proposal.newPlatitudePatterns,
      newActionPatterns:    proposal.newActionPatterns,
      dominantReasons:      proposal.dominantReasons,
    });
  } catch (err) {
    console.error("[analyze-supervisor] job failed:", err);
    res.status(500).json({
      ok:    false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
