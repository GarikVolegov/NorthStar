import { Router } from "express";
import { eq, desc, or, like, and, lt, gt } from "drizzle-orm";
import { db, newsArticlesTable } from "@workspace/db";
import { cacheGet, cacheSet } from "../lib/redis";

const router = Router();

const CACHE_TTL = 60; // 60s TTL as specified

/**
 * Encode a keyset cursor: "publishedAt|id"
 */
function encodeCursor(publishedAt: string | Date, id: number): string {
  const ts = publishedAt instanceof Date ? publishedAt.toISOString() : publishedAt;
  return Buffer.from(`${ts}|${id}`, "utf-8").toString("base64url");
}

function decodeCursor(cursor: string): [string, number] {
  const raw = Buffer.from(cursor, "base64url").toString("utf-8");
  const pipe = raw.indexOf("|");
  if (pipe === -1) return [new Date().toISOString(), 0];
  const ts = raw.slice(0, pipe);
  const id = parseInt(raw.slice(pipe + 1), 10);
  return [ts, Number.isNaN(id) ? 0 : id];
}

router.get("/", async (req, res) => {
  try {
    const { multi, categories, perCategory, category, limit } = req.query;
    const cursor = req.query.cursor as string | undefined;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));

    // Multi-category mode: fetch perCategory articles per category
    if (multi === "true" && categories) {
      const cats = (categories as string).split(",");
      const perCat = Math.max(1, parseInt(perCategory as string, 10) || 1);

      const results = await Promise.all(
        cats.map(async (cat) => {
          try {
            // Build cursor-based query per category
            let whereClause = eq(newsArticlesTable.category, cat.trim());
            if (cursor) {
              const [cursorTs, cursorId] = decodeCursor(cursor);
              whereClause = and(
                eq(newsArticlesTable.category, cat.trim()),
                or(
                  lt(newsArticlesTable.publishedAt, new Date(cursorTs)),
                  and(
                    eq(newsArticlesTable.publishedAt, new Date(cursorTs)),
                    lt(newsArticlesTable.id, cursorId),
                  ),
                ),
              ) ?? whereClause;
            }

            const articles = await db
              .select()
              .from(newsArticlesTable)
              .where(whereClause)
              .orderBy(desc(newsArticlesTable.publishedAt), desc(newsArticlesTable.id))
              .limit(perCat + 1);

            const hasMoreCat = articles.length > perCat;
            return {
              articles: hasMoreCat ? articles.slice(0, perCat) : articles,
              hasMore: hasMoreCat,
            };
          } catch {
            return { articles: [] as typeof newsArticlesTable.$inferSelect[], hasMore: false };
          }
        }),
      );

      const news = results.flatMap((r) => r.articles).map(mapNewsItem);
      const anyMore = results.some((r) => r.hasMore);
      res.json({ news, nextCursor: anyMore && news.length > 0 ? encodeCursor(news[news.length - 1].publishedAt, news[news.length - 1].id) : null });
      return;
    }

    // Try cache first for non-filtered requests
    if (!category && !cursor) {
      const cacheKey = "news:recent";
      const cached = await cacheGet<ReturnType<typeof mapNewsItem>[]>(cacheKey);
      if (cached) {
        res.json({ news: cached, nextCursor: null });
        return;
      }
    }

    // Build cursor-based WHERE clause
    let whereClause;
    if (category) {
      whereClause = eq(newsArticlesTable.category, category as string);
    }

    if (cursor) {
      const [cursorTs, cursorId] = decodeCursor(cursor);
      const cursorCond = and(
        lt(newsArticlesTable.publishedAt, new Date(cursorTs)),
        lt(newsArticlesTable.id, cursorId),
      );
      whereClause = whereClause ? and(whereClause, cursorCond) : cursorCond;
    }

    const articles = await db
      .select()
      .from(newsArticlesTable)
      .where(whereClause)
      .orderBy(desc(newsArticlesTable.publishedAt), desc(newsArticlesTable.id))
      .limit(limitNum + 1);

    const hasMore = articles.length > limitNum;
    const capped = hasMore ? articles.slice(0, limitNum) : articles;

    const mapped = capped.map(mapNewsItem);

    // Cache non-filtered first page
    if (!category && !cursor) {
      await cacheSet("news:recent", mapped, CACHE_TTL);
    }

    const last = mapped[mapped.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.publishedAt, parseInt(last.id))
      : null;

    res.json({ news: mapped, nextCursor });
  } catch (err) {
    req.log?.error?.({ err }, "news list error");
    res.json({ news: [] });
  }
});

router.get("/sector/:sectorName", async (req, res) => {
  try {
    const { sectorName } = req.params;
    const limitNum = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const cursor = req.query.cursor as string | undefined;

    // Build cursor-based query
    let whereClause = or(
      like(newsArticlesTable.sectorNames, `%${sectorName}%`),
      eq(newsArticlesTable.category, sectorName),
    );

    if (cursor) {
      const [cursorTs, cursorId] = decodeCursor(cursor);
      whereClause = and(
        whereClause,
        or(
          lt(newsArticlesTable.publishedAt, new Date(cursorTs)),
          and(
            eq(newsArticlesTable.publishedAt, new Date(cursorTs)),
            lt(newsArticlesTable.id, cursorId),
          ),
        ),
      ) ?? whereClause;
    }

    const articles = await db
      .select()
      .from(newsArticlesTable)
      .where(whereClause)
      .orderBy(desc(newsArticlesTable.publishedAt), desc(newsArticlesTable.id))
      .limit(limitNum + 1);

    const hasMore = articles.length > limitNum;
    const capped = hasMore ? articles.slice(0, limitNum) : articles;
    const mapped = capped.map(mapNewsItem);

    const last = mapped[mapped.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.publishedAt, parseInt(last.id))
      : null;

    res.json({ news: mapped, nextCursor });
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
