import { Router, type Request, type Response } from "express";
import { executionMonitor } from "../../lib/execution-monitor";
import { rootLogger } from "../../middleware/logger";

const router = Router();

router.get("/error-report", async (_req: Request, res: Response) => {
  try {
    const report = executionMonitor.getReport();
    res.json(report);
  } catch (err) {
    rootLogger.error({ err }, "[admin/error-report] error");
    res.status(500).json({ error: String(err) });
  }
});

// ── DELETE /api/admin/error-report — pulisce il buffer ──
router.delete("/error-report", async (_req: Request, res: Response) => {
  executionMonitor.clear();
  res.json({ ok: true });
});

export default router;
