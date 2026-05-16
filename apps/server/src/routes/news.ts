import { Router } from "express";
import { eq, desc, or, like } from "drizzle-orm";
import { db, newsArticlesTable } from "@workspace/db";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const { multi, categories, perCategory, category, limit } = req.query;

    if (multi === "true" && categories) {
      const cats = (categories as string).split(",");
      const perCat = Math.max(1, parseInt(perCategory as string, 10) || 1);

      const results = await Promise.all(
        cats.map(async (cat) => {
          try {
            const articles = await db
              .select()
              .from(newsArticlesTable)
              .where(eq(newsArticlesTable.category, cat.trim()))
              .orderBy(desc(newsArticlesTable.publishedAt))
              .limit(perCat);
            return articles;
          } catch {
            return [] as typeof newsArticlesTable.$inferSelect[];
          }
        }),
      );

      const news = results.flat().map(mapNewsItem);
      res.json({ news });
      return;
    }

    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));

    try {
      if (category) {
        const articles = await db
          .select()
          .from(newsArticlesTable)
          .where(eq(newsArticlesTable.category, category as string))
          .orderBy(desc(newsArticlesTable.publishedAt))
          .limit(limitNum);

        res.json({ news: articles.map(mapNewsItem) });
        return;
      }

      const articles = await db
        .select()
        .from(newsArticlesTable)
        .orderBy(desc(newsArticlesTable.publishedAt))
        .limit(limitNum);

      res.json({ news: articles.map(mapNewsItem) });
    } catch {
      res.json({ news: [] });
    }
  } catch (err) {
    req.log?.error?.({ err }, "news list error");
    res.json({ news: [] });
  }
});

router.get("/sector/:sectorName", async (req, res) => {
  try {
    const { sectorName } = req.params;
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    try {
      const articles = await db
        .select()
        .from(newsArticlesTable)
        .where(
          or(
            like(newsArticlesTable.sectorNames, `%${sectorName}%`),
            eq(newsArticlesTable.category, sectorName),
          ),
        )
        .orderBy(desc(newsArticlesTable.publishedAt))
        .limit(limitNum);

      res.json({ news: articles.map(mapNewsItem) });
    } catch {
      res.json({ news: [] });
    }
  } catch (err) {
    req.log?.error?.({ err }, "news by sector error");
    res.json({ news: [] });
  }
});

function mapNewsItem(a: typeof newsArticlesTable.$inferSelect) {
  return {
    id: String(a.id),
    title: a.title,
    description: a.summary,
    source: a.source,
    url: a.url,
    publishedAt: a.publishedAt?.toISOString() ?? new Date().toISOString(),
    image: null,
    category: a.category,
    sector: a.sectorNames?.[0] ?? null,
    tags: a.sectorNames ?? [],
    relevance: a.relevanceScore,
    plan: "free" as const,
  };
}

export default router;
