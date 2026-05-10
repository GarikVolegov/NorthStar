import { Router, type IRouter } from "express";
import { db, newsArticlesTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { runNewsResearch } from "../agents/research/news-research";
import { runGrowthResearch } from "../agents/research/growth-research";

const router: IRouter = Router();

type RunRecord = {
  id: string;
  agent: "news" | "growth";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: "running" | "completed" | "failed";
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
};

const MAX_RUN_HISTORY = 20;
const runHistory: RunRecord[] = [];

function addRun(record: RunRecord): void {
  runHistory.unshift(record);
  if (runHistory.length > MAX_RUN_HISTORY) runHistory.length = MAX_RUN_HISTORY;
}

router.get("/research/news", async (req, res): Promise<void> => {
  try {
    const sectorName = (req.query.sector as string) ?? null;
    const limit = Math.min(Number(req.query.limit ?? 20), 50);

    const articles = sectorName
      ? await db
          .select()
          .from(newsArticlesTable)
          .where(sql`${newsArticlesTable.sectorNames} @> ARRAY[${sectorName}]::text[]`)
          .orderBy(desc(newsArticlesTable.publishedAt))
          .limit(limit)
      : await db
          .select()
          .from(newsArticlesTable)
          .orderBy(desc(newsArticlesTable.publishedAt))
          .limit(limit);

    res.json({ articles, total: articles.length });
  } catch (err) {
    logger.error({ err }, "Failed to fetch research news");
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.get("/admin/research/runs", (req, res): void => {
  const adminKey = req.headers["x-admin-key"] as string | undefined;
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(runHistory);
});

router.post("/admin/research/news/run", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"] as string | undefined;
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const sectorNames = Array.isArray(req.body?.sectorNames) ? (req.body.sectorNames as string[]) : [];
  const id = `news-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const record: RunRecord = {
    id,
    agent: "news",
    startedAt,
    finishedAt: null,
    durationMs: null,
    status: "running",
    input: { sectorNames },
    result: null,
    error: null,
  };
  addRun(record);

  try {
    const t0 = Date.now();
    const result = await runNewsResearch(sectorNames);
    const durationMs = Date.now() - t0;
    record.finishedAt = new Date().toISOString();
    record.durationMs = durationMs;
    record.status = "completed";
    record.result = result as Record<string, unknown>;
    res.json({ success: true, ...result });
  } catch (err) {
    record.finishedAt = new Date().toISOString();
    record.durationMs = Date.now() - new Date(startedAt).getTime();
    record.status = "failed";
    record.error = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Manual news research trigger failed");
    res.status(500).json({ error: "Research failed" });
  }
});

router.post("/admin/research/growth/run", async (req, res): Promise<void> => {
  const adminKey = req.headers["x-admin-key"] as string | undefined;
  if (!adminKey || adminKey !== process.env.ADMIN_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = `growth-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const record: RunRecord = {
    id,
    agent: "growth",
    startedAt,
    finishedAt: null,
    durationMs: null,
    status: "running",
    input: {},
    result: null,
    error: null,
  };
  addRun(record);

  try {
    const t0 = Date.now();
    const result = await runGrowthResearch();
    const durationMs = Date.now() - t0;
    record.finishedAt = new Date().toISOString();
    record.durationMs = durationMs;
    record.status = "completed";
    record.result = result as Record<string, unknown>;
    res.json({ success: true, ...result });
  } catch (err) {
    record.finishedAt = new Date().toISOString();
    record.durationMs = Date.now() - new Date(startedAt).getTime();
    record.status = "failed";
    record.error = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Manual growth research trigger failed");
    res.status(500).json({ error: "Research failed" });
  }
});

export default router;
