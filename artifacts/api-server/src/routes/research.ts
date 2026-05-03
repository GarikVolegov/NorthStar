import { Router, type IRouter } from "express";
import { db, newsArticlesTable } from "@workspace/db";
import { desc, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { runNewsResearch } from "../agents/research/news-research";
import { runGrowthResearch } from "../agents/research/growth-research";

const router: IRouter = Router();

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

router.post("/admin/research/news/run", async (req, res): Promise<void> => {
  try {
    const sectorNames = Array.isArray(req.body?.sectorNames) ? (req.body.sectorNames as string[]) : [];
    const result = await runNewsResearch(sectorNames);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "Manual news research trigger failed");
    res.status(500).json({ error: "Research failed" });
  }
});

router.post("/admin/research/growth/run", async (req, res): Promise<void> => {
  try {
    const result = await runGrowthResearch();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error({ err }, "Manual growth research trigger failed");
    res.status(500).json({ error: "Research failed" });
  }
});

export default router;
