import { Router, type Request, type Response } from "express";
import {
  agentRunsTable,
  db,
} from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { rootLogger } from "../../middleware/logger";
import { asPlainRecord } from "../../lib/type-guards";
import {
  writeAgentRunSnapshot,
} from "./shared/agents";
import {
  runGrowthResearchReviewPipeline,
  runNewsPublishingPipeline,
} from "./shared/pipelines";

const router = Router();

function getLimit(req: Request, fallback = 100, max = 200) {
  return Math.max(1, Math.min(Number(req.query.limit) || fallback, max));
}

router.get("/research/runs", async (req: Request, res: Response) => {
  try {
    const runs = await db
      .select()
      .from(agentRunsTable)
      .where(
        sql`${agentRunsTable.agentName} in ('news', 'growth', 'news-research', 'growth-research')`,
      )
      .orderBy(desc(agentRunsTable.startedAt))
      .limit(getLimit(req, 50, 100));

    res.json(
      runs.map((run) => ({
        id: String(run.id),
        agent: run.agentName.includes("growth") ? "growth" : "news",
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.durationMs,
        status: run.status === "cancelled" ? "failed" : run.status,
        input: { summary: run.inputSummary },
        result: run.outputSummary ? { summary: run.outputSummary } : null,
        error: run.errorMessage,
      })),
    );
  } catch (err) {
    rootLogger.error({ err }, "[admin/research/runs] error");
    res.status(500).json({ error: String(err) });
  }
});

router.post("/research/news/run", async (req: Request, res: Response) => {
  const startedAt = new Date();
  try {
    const result = await runNewsPublishingPipeline({ body: asPlainRecord(req.body), startedAt });
    res.status(result.ok ? 201 : 500).json(result);
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "news-research",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      inputSummary: JSON.stringify(req.body ?? {}),
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/research/news/run] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

router.post("/research/growth/run", async (req: Request, res: Response) => {
  const startedAt = new Date();
  try {
    const result = await runGrowthResearchReviewPipeline({ body: asPlainRecord(req.body), startedAt });
    res.status(201).json(result);
  } catch (err) {
    const run = await writeAgentRunSnapshot({
      agentName: "growth-research",
      taskType: "manual_admin_run",
      startedAt,
      status: "failed",
      inputSummary: JSON.stringify(req.body ?? {}),
      errorMessage: String(err),
    }).catch(() => null);
    rootLogger.error({ err }, "[admin/research/growth/run] error");
    res.status(500).json({ ok: false, runId: run?.id, error: String(err) });
  }
});

// ── Agent Triggers ────────────────────────────────────────────────────────────

export default router;
