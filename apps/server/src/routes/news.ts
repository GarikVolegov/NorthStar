import { Router } from "express";
import { eq, desc, or, and, lt, ilike, sql, type SQL } from "drizzle-orm";
import { db, newsArticlesTable } from "@workspace/db";
import { PUBLIC_NEWS_SOURCES } from "@workspace/ai-server";
import { cacheGet, cacheSet } from "../lib/redis";
import { clampContentLimit, readContentSearchQuery } from "../lib/content-search";
import { mapNewsCategoryForUi, resolveNewsCategoryFilter } from "../lib/news-category";

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
  const sourceClauses = PUBLIC_NEWS_SOURCES.flatMap((source) => [
    sql`lower(${newsArticlesTable.source}) = ${source}`,
    sql`lower(${newsArticlesTable.source}) like ${`${source}:%`}`,
    sql`lower(${newsArticlesTable.source}) like ${`${source} -%`}`,
    sql`lower(${newsArticlesTable.source}) like ${`${source} %`}`,
  ]);
  const base = and(
    or(...sourceClauses)!,
    sql`${newsArticlesTable.url} not like 'https://northstar.internal/seed/%'`,
    sql`${newsArticlesTable.url} not ilike '%reddit.com%'`,
    sql`${newsArticlesTable.url} not ilike '%dev.to%'`,
  );
  return extra ? (and(base, extra) ?? base!) : base!;
}

function newsSearchWhere(search: string): SQL<unknown> | undefined {
  if (!search) return undefined;
  const pattern = `%${search}%`;
  return or(
    ilike(newsArticlesTable.title, pattern),
    ilike(newsArticlesTable.summary, pattern),
    ilike(newsArticlesTable.content, pattern),
    sql`${newsArticlesTable.sectorNames}::text ILIKE ${pattern}`,
    ilike(newsArticlesTable.category, pattern),
    ilike(newsArticlesTable.source, pattern),
  );
}

function cursorWhere(cursor: string): SQL<unknown> {
  const [cursorTs, cursorId] = decodeCursor(cursor);
  return or(
    lt(newsArticlesTable.publishedAt, new Date(cursorTs)),
    and(
      eq(newsArticlesTable.publishedAt, new Date(cursorTs)),
      lt(newsArticlesTable.id, cursorId),
    ),
  )!;
}

function sectorWhere(sectorName: string): SQL<unknown> {
  const pattern = `%${sectorName}%`;
  return or(
    sql`exists (select 1 from unnest(${newsArticlesTable.sectorNames}) as sector_name where sector_name ilike ${pattern})`,
    eq(newsArticlesTable.category, sectorName),
    ilike(newsArticlesTable.title, pattern),
    ilike(newsArticlesTable.summary, pattern),
  )!;
}

function categoryWhere(category: string): SQL<unknown> | undefined {
  const filter = resolveNewsCategoryFilter(category);
  if (!filter) return undefined;

  const categoryClauses = filter.categories.map((cat) => eq(newsArticlesTable.category, cat));
  const sectorClauses = filter.sectors.map((sector) => sectorWhere(sector));
  return or(...categoryClauses, ...sectorClauses);
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
    const search = readContentSearchQuery(req.query as Record<string, string | string[] | undefined>);
    const limitNum = clampContentLimit(limit as string | undefined, 20, 50);

    // Multi-category mode: fetch perCategory articles per category
    if (multi === "true" && categories) {
      const cats = (categories as string).split(",");
      const perCat = Math.max(1, parseInt(perCategory as string, 10) || 1);

      const results = await Promise.all(
        cats.map(async (cat) => {
          try {
            // Build cursor-based query per category
            const baseCategoryWhere = categoryWhere(cat.trim());
            let whereClause = publicNewsWhere(baseCategoryWhere);
            if (cursor) {
              const [cursorTs, cursorId] = decodeCursor(cursor);
              whereClause = publicNewsWhere(and(
                baseCategoryWhere,
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
          } catch (err) {
            req.log?.error?.({ err, category: cat.trim() }, "news multi-category query error");
            return { articles: [] as typeof newsArticlesTable.$inferSelect[], hasMore: false, error: "news_unavailable" };
          }
        }),
      );

      const news = results.flatMap((r) => r.articles).map(mapNewsItem);
      const anyMore = results.some((r) => r.hasMore);
      const lastNews = news.at(-1);
      const errors = results.filter((r) => "error" in r).map(() => "news_unavailable");
      res.json({
        news,
        nextCursor: anyMore && lastNews ? encodeCursor(lastNews.publishedAt, parseInt(lastNews.id, 10)) : null,
        source: errors.length > 0 ? "partial" : "live",
        ...(errors.length > 0 ? { errors } : {}),
      });
      return;
    }

    // Try cache first for non-filtered requests
    if (!category && !cursor && !search) {
      const cacheKey = "news:recent:real:v3";
      const cached = await cacheGet<ReturnType<typeof mapNewsItem>[]>(cacheKey);
      if (cached) {
        res.json({ news: cached, nextCursor: null, source: "live" });
        return;
      }
    }

    // Build cursor-based WHERE clause
    let whereClause;
    if (category) {
      whereClause = categoryWhere(category as string);
    }

    const searchClause = newsSearchWhere(search);
    if (searchClause) {
      whereClause = whereClause ? and(whereClause, searchClause) : searchClause;
    }

    if (cursor) {
      const cursorCond = cursorWhere(cursor);
      whereClause = whereClause ? and(whereClause, cursorCond) : cursorCond;
    }

    const articles = await selectNewsRows(publicNewsWhere(whereClause), limitNum + 1);

    const hasMore = articles.length > limitNum;
    const capped = hasMore ? articles.slice(0, limitNum) : articles;

    const mapped = capped.map(mapNewsItem);

    // Cache non-filtered first page
    if (!category && !cursor && !search) {
      await cacheSet("news:recent:real:v3", mapped, CACHE_TTL);
    }

    const last = mapped[mapped.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.publishedAt, parseInt(last.id))
      : null;

    res.json({ news: mapped, nextCursor, source: "live" });
  } catch (err) {
    req.log?.error?.({ err }, "news list error");
    res.status(200).json({ news: [], nextCursor: null, source: "error", error: "news_unavailable" });
  }
});

router.get("/article/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id ?? "", 10);
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
    let whereClause = sectorWhere(sectorName);

    if (cursor) {
      whereClause = and(whereClause, cursorWhere(cursor)) ?? whereClause;
    }

    const articles = await selectNewsRows(publicNewsWhere(whereClause), limitNum + 1);

    const hasMore = articles.length > limitNum;
    const capped = hasMore ? articles.slice(0, limitNum) : articles;
    const mapped = capped.map(mapNewsItem);

    const last = mapped[mapped.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.publishedAt, parseInt(last.id))
      : null;

    res.json({ news: mapped, nextCursor, source: "live" });
  } catch (err) {
    req.log?.error?.({ err }, "news by sector error");
    res.status(200).json({ news: [], nextCursor: null, source: "error", error: "news_unavailable" });
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
    category: mapNewsCategoryForUi(a.category, a.sectorNames ?? []),
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
