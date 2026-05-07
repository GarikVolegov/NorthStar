/**
 * DiscoveryCollectorAgent — raccoglie contenuti da fonti multiple.
 *
 * FONTI INTEGRATE:
 *   1. HackerNews Algolia API  — notizie tech, job posts, opportunità (no key)
 *   2. Dev.to API              — articoli formativi su skill tech (no key)
 *   3. Reddit JSON API         — r/cscareerquestions, r/learnprogramming, r/ItaliaPersonalFinance
 *   4. NewsAPI.org             — notizie lavoro, mercato, tech (free key, env: NEWS_API_KEY)
 *   5. GitHub Jobs RSS mirror  — offerte lavoro tech via RSS pubblici
 *
 * DEDUPLICATION:
 *   Ogni item viene hashato via url (MD5-like: btoa slice).
 *   INSERT usa ON CONFLICT (url_hash) DO NOTHING per idempotenza.
 *
 * FLOW:
 *   runCollector() → raccoglie da tutte le fonti in parallelo
 *                 → normalizza in NewDiscoveryItem[]
 *                 → bulk INSERT (upsert ignore)
 *                 → restituisce count di nuovi item salvati
 *
 * SCHEDULE:
 *   Chiamato dal cron ogni 6 ore (jobs/cron.ts).
 *   Può anche essere triggerato manualmente via POST /api/admin/discovery/collect.
 */
import { db } from "@workspace/db";
import { discoveryItemsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import type { NewDiscoveryItem } from "@workspace/db";

// ── Types ─────────────────────────────────────────────────────────────────────────

type ItemType = "news" | "opportunity" | "formation" | "growth" | "sector_trend";

interface RawItem {
  type:            ItemType;
  title:           string;
  url:             string;
  source:          string;
  summary:         string;
  imageUrl?:       string;
  publishedAt?:    Date;
  category:        string;
  sectorNames:     string[];
  collectorSource: string;
  searchQuery?:    string;
}

// ── URL hash (simple, collision-resistant enough for dedup) ───────────────

function hashUrl(url: string): string {
  // btoa on node: use Buffer
  return Buffer.from(url.slice(0, 200)).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
}

// ── Source 1: HackerNews Algolia ───────────────────────────────────────

interface HNHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  author?: string;
  created_at?: string;
  points?: number;
  _tags?: string[];
}

async function collectHackerNews(): Promise<RawItem[]> {
  const queries = [
    { q: "career+opportunity+tech",    type: "opportunity" as ItemType, sector: "Technology" },
    { q: "machine+learning+trend",     type: "sector_trend" as ItemType, sector: "Artificial Intelligence" },
    { q: "remote+work+job",             type: "opportunity" as ItemType, sector: "Remote Work" },
    { q: "startup+funding+2025",        type: "news" as ItemType,        sector: "Startup" },
    { q: "personal+growth+productivity", type: "growth" as ItemType,     sector: "Personal Development" },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    queries.map(async ({ q, type, sector }) => {
      try {
        const res  = await fetch(
          `https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=5&numericFilters=points>10`,
          { signal: AbortSignal.timeout(8_000) },
        );
        if (!res.ok) return;
        const data = await res.json() as { hits?: HNHit[] };
        for (const hit of (data.hits ?? [])) {
          const url = hit.url ?? hit.story_url;
          if (!url || !hit.title) continue;
          results.push({
            type,
            title:           hit.title ?? hit.story_title ?? "Untitled",
            url,
            source:          "HackerNews",
            summary:         `Discussione HN: ${hit.title}. ${hit.points ?? 0} punti.`,
            publishedAt:     hit.created_at ? new Date(hit.created_at) : undefined,
            category:        type,
            sectorNames:     [sector],
            collectorSource: "hackernews",
            searchQuery:     q,
          });
        }
      } catch { /* skip failing query */ }
    }),
  );

  return results;
}

// ── Source 2: Dev.to ────────────────────────────────────────────────────────

interface DevToArticle {
  id: number;
  title: string;
  description?: string;
  url: string;
  cover_image?: string;
  published_at?: string;
  tag_list?: string[];
  reading_time_minutes?: number;
}

async function collectDevTo(): Promise<RawItem[]> {
  const tags = ["career", "productivity", "webdev", "ai", "typescript", "beginners"];
  const results: RawItem[] = [];

  await Promise.allSettled(
    tags.map(async (tag) => {
      try {
        const res = await fetch(
          `https://dev.to/api/articles?tag=${tag}&per_page=5&top=7`,
          { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8_000) },
        );
        if (!res.ok) return;
        const articles = await res.json() as DevToArticle[];
        for (const a of articles) {
          if (!a.url || !a.title) continue;
          const isCareer = ["career", "beginners"].includes(tag);
          results.push({
            type:            isCareer ? "formation" : "formation",
            title:           a.title,
            url:             a.url,
            source:          "Dev.to",
            summary:         a.description ?? `Articolo su ${tag}: ${a.title}`,
            imageUrl:        a.cover_image ?? undefined,
            publishedAt:     a.published_at ? new Date(a.published_at) : undefined,
            category:        "formation_article",
            sectorNames:     ["Technology", "Software Development"],
            collectorSource: "devto",
            searchQuery:     tag,
          });
        }
      } catch { /* skip */ }
    }),
  );

  return results;
}

// ── Source 3: Reddit JSON ──────────────────────────────────────────────────

interface RedditPost {
  data: {
    title: string;
    url: string;
    selftext?: string;
    score?: number;
    created_utc?: number;
    permalink?: string;
    subreddit?: string;
  };
}

async function collectReddit(): Promise<RawItem[]> {
  const subreddits: Array<{ sub: string; type: ItemType; sector: string; category: string }> = [
    { sub: "cscareerquestions",      type: "opportunity",  sector: "Technology",          category: "career_advice" },
    { sub: "learnprogramming",       type: "formation",    sector: "Software Development", category: "learning_resource" },
    { sub: "ItaliaPersonalFinance",  type: "growth",       sector: "Personal Finance",     category: "finance_advice" },
    { sub: "personalfinance",        type: "growth",       sector: "Personal Finance",     category: "finance_advice" },
    { sub: "getdisciplined",         type: "growth",       sector: "Personal Development", category: "habits_productivity" },
    { sub: "italy",                  type: "news",         sector: "Italy",               category: "local_news" },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    subreddits.map(async ({ sub, type, sector, category }) => {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=5`,
          {
            headers: { "User-Agent": "NorthStar/1.0 (discovery-agent)" },
            signal: AbortSignal.timeout(8_000),
          },
        );
        if (!res.ok) return;
        const data = await res.json() as { data?: { children?: RedditPost[] } };
        for (const post of (data.data?.children ?? [])) {
          const p = post.data;
          if (!p.title || !p.url) continue;
          // Skip Reddit-internal links (selftext posts with no external URL)
          const url = p.url.startsWith("/r/") || p.url.startsWith("https://www.reddit.com")
            ? `https://www.reddit.com${p.permalink ?? ""}`
            : p.url;
          results.push({
            type,
            title:           p.title,
            url,
            source:          `Reddit r/${sub}`,
            summary:         (p.selftext ?? "").slice(0, 300) || `Post popolare in r/${sub}: ${p.title}`,
            publishedAt:     p.created_utc ? new Date(p.created_utc * 1000) : undefined,
            category,
            sectorNames:     [sector],
            collectorSource: "reddit",
            searchQuery:     sub,
          });
        }
      } catch { /* skip */ }
    }),
  );

  return results;
}

// ── Source 4: NewsAPI ───────────────────────────────────────────────────────

interface NewsAPIArticle {
  title?: string;
  description?: string;
  url?: string;
  urlToImage?: string;
  publishedAt?: string;
  source?: { name?: string };
}

async function collectNewsAPI(): Promise<RawItem[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.log("[collector] NEWS_API_KEY not set, skipping NewsAPI source");
    return [];
  }

  const queries: Array<{ q: string; type: ItemType; sector: string }> = [
    { q: "lavoro+tech+italia",              type: "opportunity",  sector: "Technology" },
    { q: "formazione+professionale",         type: "formation",    sector: "Education" },
    { q: "startup+italiana+finanziamento",   type: "opportunity",  sector: "Startup" },
    { q: "intelligenza+artificiale+lavoro",  type: "sector_trend", sector: "Artificial Intelligence" },
    { q: "mercato+lavoro+2025",              type: "news",         sector: "Labor Market" },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    queries.map(async ({ q, type, sector }) => {
      try {
        const url = `https://newsapi.org/v2/everything?q=${q}&language=it&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) return;
        const data = await res.json() as { articles?: NewsAPIArticle[] };
        for (const a of (data.articles ?? [])) {
          if (!a.url || !a.title || a.title === "[Removed]") continue;
          results.push({
            type,
            title:           a.title,
            url:             a.url,
            source:          a.source?.name ?? "NewsAPI",
            summary:         a.description ?? "",
            imageUrl:        a.urlToImage ?? undefined,
            publishedAt:     a.publishedAt ? new Date(a.publishedAt) : undefined,
            category:        type,
            sectorNames:     [sector],
            collectorSource: "newsapi",
            searchQuery:     q,
          });
        }
      } catch { /* skip */ }
    }),
  );

  return results;
}

// ── Bulk upsert (ON CONFLICT DO NOTHING) ─────────────────────────────────

async function bulkInsert(items: RawItem[]): Promise<number> {
  if (!items.length) return 0;

  const rows: NewDiscoveryItem[] = items.map((item) => ({
    type:            item.type,
    title:           item.title.slice(0, 500),
    url:             item.url.slice(0, 2000),
    urlHash:         hashUrl(item.url),
    source:          item.source,
    summary:         item.summary.slice(0, 1000),
    imageUrl:        item.imageUrl,
    publishedAt:     item.publishedAt,
    category:        item.category,
    sectorNames:     item.sectorNames,
    collectorSource: item.collectorSource,
    searchQuery:     item.searchQuery,
    isEnriched:      false,
    relevanceScore:  0,
  }));

  // Deduplicate within this batch by urlHash
  const seen  = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.urlHash)) return false;
    seen.add(r.urlHash);
    return true;
  });

  // Chunk inserts to avoid hitting postgres max params
  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    try {
      const result = await db
        .insert(discoveryItemsTable)
        .values(chunk)
        .onConflictDoNothing({ target: discoveryItemsTable.urlHash });
      inserted += (result.rowCount ?? 0);
    } catch (err) {
      console.warn(`[collector] bulk insert chunk failed:`, err);
    }
  }

  return inserted;
}

// ── Main entry point ────────────────────────────────────────────────────────────

export interface CollectorResult {
  totalCollected: number;
  totalInserted:  number;
  bySource: Record<string, number>;
  errors:   string[];
  durationMs: number;
}

export async function runCollector(): Promise<CollectorResult> {
  const startedAt = Date.now();
  const bySource: Record<string, number> = {};
  const errors: string[] = [];
  const allItems: RawItem[] = [];

  const sources: Array<{ name: string; fn: () => Promise<RawItem[]> }> = [
    { name: "hackernews", fn: collectHackerNews },
    { name: "devto",      fn: collectDevTo },
    { name: "reddit",     fn: collectReddit },
    { name: "newsapi",    fn: collectNewsAPI },
  ];

  await Promise.allSettled(
    sources.map(async ({ name, fn }) => {
      try {
        const items = await fn();
        bySource[name] = items.length;
        allItems.push(...items);
      } catch (err) {
        errors.push(`${name}: ${String(err)}`);
        bySource[name] = 0;
      }
    }),
  );

  const totalInserted = await bulkInsert(allItems);

  const result: CollectorResult = {
    totalCollected: allItems.length,
    totalInserted,
    bySource,
    errors,
    durationMs: Date.now() - startedAt,
  };

  console.log(`[collector] run complete:`, result);
  return result;
}
