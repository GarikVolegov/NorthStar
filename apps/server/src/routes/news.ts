import { Router } from "express";
import type { Response } from "express";
import { eq, desc, or, and, lt, ilike, sql, type SQL } from "drizzle-orm";
import { db, newsArticlesTable } from "@workspace/db";
import { PUBLIC_NEWS_SOURCES, runNewsPublisher } from "@workspace/ai-server";
import { cacheGet, cacheSet } from "../lib/redis";
import { clampContentLimit, readContentSearchQuery } from "../lib/content-search";
import { resolveNewsCategoryFilter } from "../lib/news-category";
import {
  buildNewsProviderDiagnostics,
  type NewsProviderDiagnostics,
} from "../lib/news-provider-diagnostics";
import {
  FALLBACK_IMAGE_THEMES,
  escapeSvgText,
  mapNewsDetail,
  mapNewsItem,
  readHexColor,
  type NewsArticleRow,
  type NewsLocale,
} from "./news-presentation";

const router = Router();

const CACHE_TTL = 60; // 60s TTL as specified
const NEWS_AUTO_REFRESH_STALE_MS = Number(process.env.NEWS_AUTO_REFRESH_STALE_MS) || 48 * 60 * 60 * 1000;
const NEWS_AUTO_REFRESH_COOLDOWN_MS = process.env.NODE_ENV === "test" || process.env.VITEST
  ? 0
  : Number(process.env.NEWS_AUTO_REFRESH_COOLDOWN_MS) || 5 * 60 * 1000;
type NewsFeedStatus = "ok" | "empty" | "partial" | "error";
type NewsRefreshReason = "empty" | "stale";

type NewsRefreshResult = {
  attempted: boolean;
  reason: NewsRefreshReason;
  transferred: number;
  missingCoverage: number;
  durationMs: number;
  error?: string;
};

let newsRefreshInFlight: Promise<NewsRefreshResult> | null = null;
let lastNewsRefreshAt = 0;
let lastNewsRefreshResult: NewsRefreshResult | null = null;

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

function newsStatus(newsCount: number): NewsFeedStatus {
  return newsCount > 0 ? "ok" : "empty";
}

function readNewsLocale(value: unknown): NewsLocale {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = typeof raw === "string" ? raw.slice(0, 2).toLowerCase() : "it";
  return ["it", "en", "es", "fr", "de"].includes(normalized) ? normalized as NewsLocale : "it";
}

function isStaleNewsRow(row: NewsArticleRow | undefined): boolean {
  if (!row?.publishedAt) return false;
  const publishedAt = row.publishedAt instanceof Date ? row.publishedAt : new Date(row.publishedAt);
  if (!Number.isFinite(publishedAt.getTime())) return false;
  return Date.now() - publishedAt.getTime() > NEWS_AUTO_REFRESH_STALE_MS;
}

function isStaleMappedNewsItem(item: ReturnType<typeof mapNewsItem> | undefined): boolean {
  if (!item?.publishedAt) return false;
  const publishedAt = new Date(item.publishedAt);
  if (!Number.isFinite(publishedAt.getTime())) return false;
  return Date.now() - publishedAt.getTime() > NEWS_AUTO_REFRESH_STALE_MS;
}

async function runAutoNewsRefresh(reason: NewsRefreshReason, log?: { warn?: (payload: unknown, message?: string) => void }): Promise<NewsRefreshResult> {
  if (
    NEWS_AUTO_REFRESH_COOLDOWN_MS > 0
    && lastNewsRefreshResult
    && Date.now() - lastNewsRefreshAt < NEWS_AUTO_REFRESH_COOLDOWN_MS
  ) {
    return {
      attempted: false,
      reason,
      transferred: 0,
      missingCoverage: lastNewsRefreshResult.missingCoverage,
      durationMs: 0,
      ...(lastNewsRefreshResult.error ? { error: lastNewsRefreshResult.error } : {}),
    };
  }

  if (!newsRefreshInFlight) {
    const startedAt = Date.now();
    newsRefreshInFlight = runNewsPublisher()
      .then((result) => {
        const refreshResult = {
          attempted: true,
          reason,
          transferred: result.transferred,
          missingCoverage: result.missingCoverage.length,
          durationMs: result.durationMs,
        };
        lastNewsRefreshAt = Date.now();
        lastNewsRefreshResult = refreshResult;
        return refreshResult;
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        log?.warn?.({ err, reason }, "news auto-refresh failed");
        const refreshResult = {
          attempted: true,
          reason,
          transferred: 0,
          missingCoverage: 0,
          durationMs: Date.now() - startedAt,
          error: message,
        };
        lastNewsRefreshAt = Date.now();
        lastNewsRefreshResult = refreshResult;
        return refreshResult;
      })
      .finally(() => {
        newsRefreshInFlight = null;
      });
  }

  return newsRefreshInFlight;
}

async function diagnosticsWithRefreshError(refresh?: NewsRefreshResult): Promise<NewsProviderDiagnostics> {
  const diagnostics = await buildNewsProviderDiagnostics();
  if (refresh?.error) {
    return {
      ...diagnostics,
      lastRefreshError: refresh.error,
      refreshAction: "retry_later",
      message: `${diagnostics.message} Ultimo refresh automatico fallito: ${refresh.error}`,
    };
  }
  return diagnostics;
}

function isTotalProviderFailure(diagnostics: NewsProviderDiagnostics): boolean {
  return diagnostics.enabledSources > 0 && diagnostics.sourcesWithErrors >= diagnostics.enabledSources;
}

function sendNewsUnavailableWithDiagnostics(res: Response, diagnostics: NewsProviderDiagnostics) {
  res.status(503).json({
    news: [],
    nextCursor: null,
    source: "error",
    status: "error" satisfies NewsFeedStatus,
    error: "news_unavailable",
    diagnostics,
  });
}

async function sendNewsUnavailable(res: Response) {
  sendNewsUnavailableWithDiagnostics(res, await buildNewsProviderDiagnostics());
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
    const locale = readNewsLocale(req.query.locale);
    const cursor = req.query.cursor as string | undefined;
    const search = readContentSearchQuery(req.query as Record<string, string | string[] | undefined>);
    const limitNum = clampContentLimit(limit as string | undefined, 20, 50);

    // Multi-category mode: fetch perCategory articles per category
    if (multi === "true" && categories) {
      const cats = (categories as string).split(",");
      const perCat = Math.max(1, parseInt(perCategory as string, 10) || 1);

      const loadCategoryResults = () => Promise.all(
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

      let refresh: NewsRefreshResult | undefined;
      let results = await loadCategoryResults();
      let news = results.flatMap((r) => r.articles).map((article) => mapNewsItem(article, locale));
      if (!cursor && news.length === 0) {
        refresh = await runAutoNewsRefresh("empty", req.log);
        results = await loadCategoryResults();
        news = results.flatMap((r) => r.articles).map((article) => mapNewsItem(article, locale));
      }

      const anyMore = results.some((r) => r.hasMore);
      const lastNews = news.at(-1);
      const errors = results.filter((r) => "error" in r).map(() => "news_unavailable");
      if (errors.length > 0 && news.length === 0) {
        await sendNewsUnavailable(res);
        return;
      }
      const status: NewsFeedStatus = errors.length > 0 ? "partial" : newsStatus(news.length);
      res.json({
        news,
        nextCursor: anyMore && lastNews ? encodeCursor(lastNews.publishedAt, parseInt(lastNews.id, 10)) : null,
        source: errors.length > 0 ? "partial" : (refresh?.transferred ? "auto_refresh" : "live"),
        status,
        ...(refresh ? { refresh } : {}),
        ...(errors.length > 0 ? { errors } : {}),
        ...(status !== "ok" ? { diagnostics: await diagnosticsWithRefreshError(refresh) } : {}),
      });
      return;
    }

    // Try cache first for non-filtered requests
    if (!category && !cursor && !search) {
      const cacheKey = `news:recent:real:v3:${locale}`;
      const cached = await cacheGet<ReturnType<typeof mapNewsItem>[]>(cacheKey);
      if (cached && cached.length > 0 && !isStaleMappedNewsItem(cached[0])) {
        const status = newsStatus(cached.length);
        const diagnostics = status === "empty" ? await buildNewsProviderDiagnostics() : undefined;
        if (diagnostics && isTotalProviderFailure(diagnostics)) {
          sendNewsUnavailableWithDiagnostics(res, diagnostics);
          return;
        }
        res.json({
          news: cached,
          nextCursor: null,
          source: "live",
          status,
          ...(diagnostics ? { diagnostics } : {}),
        });
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

    let articles = await selectNewsRows(publicNewsWhere(whereClause), limitNum + 1);
    let refresh: NewsRefreshResult | undefined;
    if (!cursor && !search && (articles.length === 0 || isStaleNewsRow(articles[0]))) {
      refresh = await runAutoNewsRefresh(articles.length === 0 ? "empty" : "stale", req.log);
      articles = await selectNewsRows(publicNewsWhere(whereClause), limitNum + 1);
    }

    const hasMore = articles.length > limitNum;
    const capped = hasMore ? articles.slice(0, limitNum) : articles;

    const mapped = capped.map((article) => mapNewsItem(article, locale));

    // Cache non-filtered first page
    if (!category && !cursor && !search) {
      await cacheSet(`news:recent:real:v3:${locale}`, mapped, CACHE_TTL);
    }

    const last = mapped[mapped.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.publishedAt, parseInt(last.id))
      : null;

    const status = newsStatus(mapped.length);
    const diagnostics = status === "empty" ? await diagnosticsWithRefreshError(refresh) : undefined;
    if (diagnostics && isTotalProviderFailure(diagnostics)) {
      sendNewsUnavailableWithDiagnostics(res, diagnostics);
      return;
    }
    res.json({
      news: mapped,
      nextCursor,
      source: refresh?.transferred ? "auto_refresh" : "live",
      status,
      ...(refresh ? { refresh } : {}),
      ...(diagnostics ? { diagnostics } : {}),
    });
  } catch (err) {
    req.log?.error?.({ err }, "news list error");
    await sendNewsUnavailable(res);
  }
});

router.get("/fallback-image/:category.svg", (req, res) => {
  const category = req.params.category ?? "general";
  const theme = FALLBACK_IMAGE_THEMES[category] ?? FALLBACK_IMAGE_THEMES.general!;
  const from = readHexColor(req.query.from, theme.from);
  const to = readHexColor(req.query.to, theme.to);
  const icon = escapeSvgText(req.query.icon ?? theme.icon);
  const title = escapeSvgText(req.query.title ?? category);

  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675" role="img" aria-label="${title}">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#${from}"/>
      <stop offset="1" stop-color="#${to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="675" fill="url(#g)"/>
  <circle cx="1010" cy="120" r="180" fill="#ffffff" opacity=".12"/>
  <circle cx="150" cy="560" r="220" fill="#000000" opacity=".16"/>
  <path d="M120 505h960" stroke="#fff" stroke-width="2" opacity=".22"/>
  <text x="96" y="124" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700" opacity=".9">${icon}</text>
  <text x="96" y="535" fill="#ffffff" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="800">NorthStar News</text>
</svg>`);
});

router.get("/article/:id", async (req, res) => {
  try {
    const locale = readNewsLocale(req.query.locale);
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

    res.json({ article: mapNewsDetail(article, locale) });
  } catch (err) {
    req.log?.error?.({ err }, "news detail error");
    res.status(500).json({ error: "Unable to load news article" });
  }
});

router.get("/sector/:sectorName", async (req, res) => {
  try {
    const { sectorName } = req.params;
    const locale = readNewsLocale(req.query.locale);
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
    const mapped = capped.map((article) => mapNewsItem(article, locale));

    const last = mapped[mapped.length - 1];
    const nextCursor = hasMore && last
      ? encodeCursor(last.publishedAt, parseInt(last.id))
      : null;

    const status = newsStatus(mapped.length);
    const diagnostics = status === "empty" ? await buildNewsProviderDiagnostics() : undefined;
    if (diagnostics && isTotalProviderFailure(diagnostics)) {
      sendNewsUnavailableWithDiagnostics(res, diagnostics);
      return;
    }
    res.json({
      news: mapped,
      nextCursor,
      source: "live",
      status,
      ...(diagnostics ? { diagnostics } : {}),
    });
  } catch (err) {
    req.log?.error?.({ err }, "news by sector error");
    await sendNewsUnavailable(res);
  }
});

export default router;
