import { Router } from "express";
import { eq, desc, or, like, and, lt, sql, type SQL } from "drizzle-orm";
import { db, newsArticlesTable } from "@workspace/db";
import { PUBLIC_NEWS_SOURCES } from "@workspace/ai-server";
import { cacheGet, cacheSet } from "../lib/redis";
import {
  getStaticNewsItems,
  getStaticNewsDetail,
  isStaticNewsId,
} from "../lib/news-fallback";

const router = Router();

const CACHE_TTL = 60; // 60s TTL as specified
type NewsArticleRow = typeof newsArticlesTable.$inferSelect;

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

function isMissingColumnError(err: unknown): boolean {
  const message = String((err as { message?: unknown })?.message ?? err).toLowerCase();
  return message.includes("column") && message.includes("does not exist");
}

function publicNewsWhere(extra?: SQL<unknown>): SQL<unknown> {
  const sourceList = sql.join(
    PUBLIC_NEWS_SOURCES.map((source) => sql`${source}`),
    sql`, `,
  );
  const base = and(
    sql`lower(${newsArticlesTable.source}) in (${sourceList})`,
    sql`${newsArticlesTable.url} not like 'https://northstar.internal/seed/%'`,
    sql`${newsArticlesTable.url} not ilike '%reddit.com%'`,
    sql`${newsArticlesTable.url} not ilike '%dev.to%'`,
  );
  return extra ? (and(base, extra) ?? base!) : base!;
}

function legacyNewsSelect() {
  return {
    id: newsArticlesTable.id,
    embedding: newsArticlesTable.embedding,
    title: newsArticlesTable.title,
    url: newsArticlesTable.url,
    urlHash: newsArticlesTable.urlHash,
    source: newsArticlesTable.source,
    summary: newsArticlesTable.summary,
    imageUrl: sql<string | null>`null`,
    content: sql<string | null>`null`,
    publishedAt: newsArticlesTable.publishedAt,
    sectorNames: newsArticlesTable.sectorNames,
    category: newsArticlesTable.category,
    relevanceScore: newsArticlesTable.relevanceScore,
    searchQuery: newsArticlesTable.searchQuery,
    createdAt: newsArticlesTable.createdAt,
  };
}

async function selectNewsRows(
  whereClause: SQL<unknown> | undefined,
  limitNum: number,
): Promise<NewsArticleRow[]> {
  try {
    return await db
      .select()
      .from(newsArticlesTable)
      .where(whereClause as never)
      .orderBy(desc(newsArticlesTable.publishedAt), desc(newsArticlesTable.id))
      .limit(limitNum);
  } catch (err) {
    if (!isMissingColumnError(err)) throw err;
    return await db
      .select(legacyNewsSelect())
      .from(newsArticlesTable)
      .where(whereClause as never)
      .orderBy(desc(newsArticlesTable.publishedAt), desc(newsArticlesTable.id))
      .limit(limitNum) as NewsArticleRow[];
  }
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
            let whereClause = publicNewsWhere(eq(newsArticlesTable.category, cat.trim()));
            if (cursor) {
              const [cursorTs, cursorId] = decodeCursor(cursor);
              whereClause = publicNewsWhere(and(
                eq(newsArticlesTable.category, cat.trim()),
                or(
                  lt(newsArticlesTable.publishedAt, new Date(cursorTs)),
                  and(
                    eq(newsArticlesTable.publishedAt, new Date(cursorTs)),
                    lt(newsArticlesTable.id, cursorId),
                  ),
                ),
              ));
            }

            const articles = await selectNewsRows(whereClause, perCat + 1);

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
      const lastNews = news.at(-1);
      res.json({ news, nextCursor: anyMore && lastNews ? encodeCursor(lastNews.publishedAt, parseInt(lastNews.id, 10)) : null });
      return;
    }

    // Try cache first for non-filtered requests
    if (!category && !cursor) {
      const cacheKey = "news:recent:real:v1";
      const cached = await cacheGet<ReturnType<typeof mapNewsItem>[]>(cacheKey);
      if (cached && cached.length > 0) {
        res.json({ news: cached, nextCursor: null, source: "live" });
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

    const articles = await selectNewsRows(publicNewsWhere(whereClause), limitNum + 1);

    const hasMore = articles.length > limitNum;
    const capped = hasMore ? articles.slice(0, limitNum) : articles;

    const mapped = capped.map(mapNewsItem);

    // Empty result (fresh DB before the discovery agent has populated
    // news_articles) → static fallback so /news is never blank. First page only.
    if (mapped.length === 0 && !cursor) {
      res.json({
        news: getStaticNewsItems({ category: category as string | undefined, limit: limitNum }),
        nextCursor: null,
        source: "static",
      });
      return;
    }

    // Cache non-filtered first page (only real, non-empty results)
    if (!category && !cursor && mapped.length > 0) {
      await cacheSet("news:recent:real:v1", mapped, CACHE_TTL);
    }

    const last = mapped[mapped.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.publishedAt, parseInt(last.id))
      : null;

    res.json({ news: mapped, nextCursor, source: "live" });
  } catch (err) {
    req.log?.error?.({ err }, "news list error");
    res.status(200).json({
      news: getStaticNewsItems({ limit: 12 }),
      nextCursor: null,
      source: "static",
    });
  }
});

router.get("/article/:id", async (req, res) => {
  try {
    const rawId = req.params.id ?? "";

    // Static fallback articles (sample-*) have no DB row.
    if (isStaticNewsId(rawId)) {
      const detail = getStaticNewsDetail(rawId);
      if (!detail) {
        res.status(404).json({ error: "News article not found" });
        return;
      }
      res.json({ article: detail });
      return;
    }

    const id = parseInt(rawId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({ error: "Invalid news id" });
      return;
    }

    const [article] = await selectNewsRows(publicNewsWhere(eq(newsArticlesTable.id, id)), 1);

    if (!article) {
      res.status(404).json({ error: "News article not found" });
      return;
    }

    res.json({ article: mapNewsDetail(article) });
  } catch (err) {
    req.log?.error?.({ err }, "news detail error");
    res.status(500).json({ error: "Unable to load news article" });
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

    const articles = await selectNewsRows(publicNewsWhere(whereClause), limitNum + 1);

    const hasMore = articles.length > limitNum;
    const capped = hasMore ? articles.slice(0, limitNum) : articles;
    const mapped = capped.map(mapNewsItem);

    if (mapped.length === 0 && !cursor) {
      res.json({
        news: getStaticNewsItems({ sector: sectorName, limit: limitNum }),
        nextCursor: null,
        source: "static",
      });
      return;
    }

    const last = mapped[mapped.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.publishedAt, parseInt(last.id))
      : null;

    res.json({ news: mapped, nextCursor, source: "live" });
  } catch (err) {
    req.log?.error?.({ err }, "news by sector error");
    res.json({
      news: getStaticNewsItems({ sector: req.params.sectorName, limit: 12 }),
      source: "static",
    });
  }
});

function fallbackContent(a: typeof newsArticlesTable.$inferSelect): string {
  const summary = a.summary?.trim() || a.title;
  const sectors = a.sectorNames?.length ? a.sectorNames.join(", ") : "mercato del lavoro";
  return [
    "### Cosa e successo",
    summary,
    "",
    "### Perche conta per NorthStar",
    `Questa notizia e rilevante per chi sta osservando ${sectors} e vuole capire come cambiano lavoro, business, formazione e competenze richieste.`,
    "",
    "### Impatto pratico",
    "Usala come segnale per aggiornare il tuo percorso, confrontare nuove opportunita e capire quali skill potrebbero diventare piu importanti.",
    "",
    "### Cosa osservare",
    "Controlla la fonte originale e monitora eventuali aggiornamenti, reazioni del settore e impatti su ruoli, salari o domanda di competenze.",
  ].join("\n");
}

function mapNewsItem(a: typeof newsArticlesTable.$inferSelect) {
  const publishedAt = a.publishedAt instanceof Date
    ? a.publishedAt.toISOString()
    : (a.publishedAt ? String(a.publishedAt) : new Date().toISOString());
  return {
    id: String(a.id),
    title: a.title,
    preview: a.summary,
    description: a.summary,
    source: a.source,
    sourceUrl: a.url,
    url: a.url,
    detailUrl: `/news/${a.id}`,
    publishedAt,
    image: a.imageUrl ?? null,
    category: a.category,
    sector: a.sectorNames?.[0] ?? null,
    tags: a.sectorNames ?? [],
    relevance: a.relevanceScore,
    plan: "free" as const,
  };
}

function mapNewsDetail(a: typeof newsArticlesTable.$inferSelect) {
  const item = mapNewsItem(a);
  return {
    ...item,
    content: a.content?.trim() || fallbackContent(a),
    sourceUrl: a.url,
    url: a.url,
  };
}

export default router;
