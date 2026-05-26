import { Router, type Request, type Response } from "express";
import { rootLogger } from "../../middleware/logger";
import {
  runGrowthResearchReviewPipeline,
  runMarketRefreshPipeline,
  runNewsPublishingPipeline,
} from "./shared/pipelines";

const router = Router();

function bodyRecord(req: Request): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
}

router.post("/pipelines/news-publishing/run", async (req: Request, res: Response) => {
  try {
    const result = await runNewsPublishingPipeline({ body: bodyRecord(req) });
    res.status(result.ok ? 201 : 500).json(result);
  } catch (err) {
    rootLogger.error({ err }, "[admin/pipelines/news-publishing/run] error");
    res.status(500).json({ ok: false, warnings: [], error: String(err) });
  }
});

router.post("/pipelines/growth-research-review/run", async (req: Request, res: Response) => {
  try {
    const result = await runGrowthResearchReviewPipeline({ body: bodyRecord(req) });
    res.status(201).json(result);
  } catch (err) {
    rootLogger.error({ err }, "[admin/pipelines/growth-research-review/run] error");
    res.status(500).json({ ok: false, warnings: [], error: String(err) });
  }
});

router.post("/pipelines/market-refresh/run", async (req: Request, res: Response) => {
  try {
    const result = await runMarketRefreshPipeline({ body: bodyRecord(req) });
    res.status(result.ok ? 201 : 500).json(result);
  } catch (err) {
    rootLogger.error({ err }, "[admin/pipelines/market-refresh/run] error");
    res.status(500).json({ ok: false, warnings: [], error: String(err) });
  }
});

export default router;
