/**
 * DiscoveryCollectorAgent — raccoglie contenuti da fonti multiple.
 *
 * FONTI INTEGRATE:
 *   1. HackerNews Algolia API  — notizie tech, job posts, opportunità (no key)
 *   2. Dev.to API              — articoli formativi su skill tech (no key)
 *   3. Reddit JSON API         — r/cscareerquestions, r/learnprogramming, r/ItaliaPersonalFinance
 *   4. NewsAPI.org             — notizie lavoro, mercato, tech (free key, env: NEWS_API_KEY)
 *   ── D7: Fonti formazione certificata ──────────────────────────────────────
 *   5. Coursera Blog RSS       — articoli, guide carriera, annunci corsi (no key)
 *   6. Udemy Blog RSS          — articoli su skill, trend, learning (no key)
 *   7. MIT OpenCourseWare RSS  — nuovi corsi MIT OCW (no key)
 *   8. YouTube EDU RSS         — video formativi da canali tech/career selezionati (no key)
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
 *
 * NOTE SU RSS:
 *   Il parsing RSS è fatto senza dipendenze esterne (fast-xml-parser / rss-parser)
 *   per non aggiungere bundle size. Usa un parser XML minimale interno basato su
 *   regex robuste che copre Atom e RSS 2.0. Se si vuole più robustezza,
 *   aggiungere `rss-parser` e sostituire parseRSS().
 */
import { db } from "@workspace/db";
import { discoveryItemsTable } from "@workspace/db";
import type { NewDiscoveryItem } from "@workspace/db";

// ── Types ──────────────────────────────────────────────────────────────────────

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

// ── URL hash ────────────────────────────────────────────────────────────────────

function hashUrl(url: string): string {
  return Buffer.from(url.slice(0, 200)).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 64);
}

// ── Minimal RSS/Atom parser (no external deps) ─────────────────────────────────
//
// Supports:
//   - RSS 2.0: <item><title><link><description><pubDate><enclosure url/>
//   - Atom:    <entry><title><link href/><summary><content><published>
//   - Media:   <media:thumbnail url/> <media:content url/>
//
// Returns up to `limit` parsed entries.

interface RSSEntry {
  title:       string;
  url:         string;
  summary:     string;
  imageUrl?:   string;
  publishedAt?: Date;
}

function extractTag(xml: string, tag: string): string {
  // Handles <tag>content</tag> and CDATA
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\/${tag}>`, "i");
  const m  = xml.match(re);
  if (!m) return "";
  return ((m[1] ?? m[2]) ?? "").trim();
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "i");
  const m  = xml.match(re);
  return m?.[1]?.trim() ?? "";
}

function parseRSS(xml: string, limit = 8): RSSEntry[] {
  // Split on <item> (RSS 2.0) or <entry> (Atom)
  const itemRe = /<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi;
  const blocks = xml.match(itemRe) ?? [];
  const entries: RSSEntry[] = [];

  for (const block of blocks.slice(0, limit)) {
    // Title
    const title = extractTag(block, "title");
    if (!title) continue;

    // URL: try <link> text, then <link href="...">, then <url>
    let url = extractTag(block, "link").trim();
    if (!url || url.startsWith("<")) url = extractAttr(block, "link", "href");
    if (!url) url = extractTag(block, "url");
    if (!url || !url.startsWith("http")) continue;

    // Summary: <description> or <summary> or <content>
    const summary = (extractTag(block, "description")
      || extractTag(block, "summary")
      || extractTag(block, "content"))
      .replace(/<[^>]+>/g, "")   // strip HTML tags
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 400)
      .trim();

    // Image: enclosure, media:thumbnail, media:content, og:image-like pattern
    const imageUrl =
      extractAttr(block, "enclosure", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      extractAttr(block, "media:content", "url") ||
      undefined;

    // Date: <pubDate> or <published> or <updated>
    const dateStr = extractTag(block, "pubDate")
      || extractTag(block, "published")
      || extractTag(block, "updated");
    let publishedAt: Date | undefined;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) publishedAt = d;
    }

    entries.push({ title, url, summary, imageUrl, publishedAt });
  }

  return entries;
}

async function fetchRSS(feedUrl: string, limit = 8): Promise<RSSEntry[]> {
  const res = await fetch(feedUrl, {
    headers: { "Accept": "application/rss+xml, application/xml, text/xml, */*",
               "User-Agent": "NorthStar/1.0 (discovery-agent; formation-collector)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  return parseRSS(xml, limit);
}

// ── Source 1: HackerNews Algolia ───────────────────────────────────────────────

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
    { q: "career+opportunity+tech",     type: "opportunity"  as ItemType, sector: "Technology" },
    { q: "machine+learning+trend",      type: "sector_trend" as ItemType, sector: "Artificial Intelligence" },
    { q: "remote+work+job",              type: "opportunity"  as ItemType, sector: "Remote Work" },
    { q: "startup+funding+2025",         type: "news"         as ItemType, sector: "Startup" },
    { q: "personal+growth+productivity", type: "growth"       as ItemType, sector: "Personal Development" },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    queries.map(async ({ q, type, sector }) => {
      try {
        const res = await fetch(
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
      } catch { /* skip */ }
    }),
  );

  return results;
}

// ── Source 2: Dev.to API ───────────────────────────────────────────────────────

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
  const tags    = ["career", "productivity", "webdev", "ai", "typescript", "beginners"];
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
          results.push({
            type:            "formation",
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

// ── Source 3: Reddit JSON ──────────────────────────────────────────────────────

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
    { sub: "cscareerquestions",     type: "opportunity", sector: "Technology",          category: "career_advice" },
    { sub: "learnprogramming",      type: "formation",   sector: "Software Development", category: "learning_resource" },
    { sub: "ItaliaPersonalFinance", type: "growth",      sector: "Personal Finance",     category: "finance_advice" },
    { sub: "personalfinance",       type: "growth",      sector: "Personal Finance",     category: "finance_advice" },
    { sub: "getdisciplined",        type: "growth",      sector: "Personal Development", category: "habits_productivity" },
    { sub: "italy",                 type: "news",        sector: "Italy",               category: "local_news" },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    subreddits.map(async ({ sub, type, sector, category }) => {
      try {
        const res = await fetch(
          `https://www.reddit.com/r/${sub}/hot.json?limit=5`,
          { headers: { "User-Agent": "NorthStar/1.0 (discovery-agent)" },
            signal: AbortSignal.timeout(8_000) },
        );
        if (!res.ok) return;
        const data = await res.json() as { data?: { children?: RedditPost[] } };
        for (const post of (data.data?.children ?? [])) {
          const p = post.data;
          if (!p.title || !p.url) continue;
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

// ── Source 4: NewsAPI ──────────────────────────────────────────────────────────

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
    { q: "lavoro+tech+italia",             type: "opportunity",  sector: "Technology" },
    { q: "formazione+professionale",        type: "formation",    sector: "Education" },
    { q: "startup+italiana+finanziamento",  type: "opportunity",  sector: "Startup" },
    { q: "intelligenza+artificiale+lavoro", type: "sector_trend", sector: "Artificial Intelligence" },
    { q: "mercato+lavoro+2025",             type: "news",         sector: "Labor Market" },
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

// ── D7 Source 5: Coursera Blog RSS ─────────────────────────────────────────────
//
// Coursera pubblica un blog RSS con:
//   - Annunci di nuovi corsi e specializzazioni
//   - Guide carriera ("How to become a data scientist")
//   - Trend del mercato del lavoro basati sui loro dati di enrollment
//
// Feed: https://blog.coursera.org/feed/
// Tipo: formation | sector_trend
// Nessuna API key richiesta.

async function collectCourseraRSS(): Promise<RawItem[]> {
  const feeds: Array<{ url: string; sector: string; type: ItemType; category: string }> = [
    {
      url:      "https://blog.coursera.org/feed/",
      sector:   "Education",
      type:     "formation",
      category: "course_announcement",
    },
    {
      // Coursera Career Hub feed (se disponibile) — fallback al blog principale
      url:      "https://blog.coursera.org/career-development/feed/",
      sector:   "Career Development",
      type:     "formation",
      category: "career_guide",
    },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    feeds.map(async ({ url, sector, type, category }) => {
      try {
        const entries = await fetchRSS(url, 6);
        for (const e of entries) {
          results.push({
            type,
            title:           e.title,
            url:             e.url,
            source:          "Coursera Blog",
            summary:         e.summary || `Articolo Coursera: ${e.title}`,
            imageUrl:        e.imageUrl,
            publishedAt:     e.publishedAt,
            category,
            sectorNames:     [sector, "Online Learning"],
            collectorSource: "coursera_rss",
            searchQuery:     sector,
          });
        }
      } catch (err) {
        console.warn(`[collector] Coursera RSS (${url}) failed:`, String(err));
      }
    }),
  );

  return results;
}

// ── D7 Source 6: Udemy Blog RSS ────────────────────────────────────────────────
//
// Il blog Udemy pubblica:
//   - Articoli su skill di tendenza ("Top skills employers want in 2025")
//   - Guide su come imparare argomenti specifici
//   - Report annuali sull'apprendimento (Workplace Learning Trends)
//
// Feed: https://blog.udemy.com/feed/
// Tipo: formation | sector_trend
// Nessuna API key richiesta.

async function collectUdemyRSS(): Promise<RawItem[]> {
  const feeds: Array<{ url: string; sector: string; category: string }> = [
    { url: "https://blog.udemy.com/feed/",                     sector: "Online Learning",    category: "learning_guide" },
    { url: "https://blog.udemy.com/category/workplace/feed/",   sector: "Career Development", category: "workplace_skills" },
    { url: "https://blog.udemy.com/category/developer/feed/",   sector: "Technology",         category: "developer_skills" },
    { url: "https://blog.udemy.com/category/data-science/feed/",sector: "Data Science",       category: "data_skills" },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    feeds.map(async ({ url, sector, category }) => {
      try {
        const entries = await fetchRSS(url, 5);
        for (const e of entries) {
          // Classify: if title mentions "trend", "report", "2025" → sector_trend, else formation
          const isReport = /trend|report|top \d|in \d{4}|stat|survey/i.test(e.title);
          results.push({
            type:            isReport ? "sector_trend" : "formation",
            title:           e.title,
            url:             e.url,
            source:          "Udemy Blog",
            summary:         e.summary || `Guida Udemy: ${e.title}`,
            imageUrl:        e.imageUrl,
            publishedAt:     e.publishedAt,
            category,
            sectorNames:     [sector, "Skills Development"],
            collectorSource: "udemy_rss",
            searchQuery:     sector,
          });
        }
      } catch (err) {
        console.warn(`[collector] Udemy RSS (${url}) failed:`, String(err));
      }
    }),
  );

  return results;
}

// ── D7 Source 7: MIT OpenCourseWare RSS ───────────────────────────────────────
//
// MIT OCW pubblica un feed dei nuovi corsi pubblicati/aggiornati.
// Include corsi su: CS, Math, Engineering, Management, Economics.
// Contenuto libero e di altissima qualità, ottimo per utenti ambiziosi.
//
// Feed: https://ocw.mit.edu/rss/new_courses.xml
// Tipo: formation (sempre)
// Nessuna API key richiesta.

async function collectMITOpenCourseWare(): Promise<RawItem[]> {
  const feeds = [
    { url: "https://ocw.mit.edu/rss/new_courses.xml",       sector: "Academic" },
    { url: "https://ocw.mit.edu/rss/recently_published.xml", sector: "Academic" },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    feeds.map(async ({ url, sector }) => {
      try {
        const entries = await fetchRSS(url, 5);
        for (const e of entries) {
          results.push({
            type:            "formation",
            title:           `[MIT OCW] ${e.title}`,
            url:             e.url,
            source:          "MIT OpenCourseWare",
            summary:         e.summary || `Corso MIT gratuito: ${e.title}`,
            imageUrl:        e.imageUrl,
            publishedAt:     e.publishedAt,
            category:        "university_course",
            sectorNames:     [sector, "University", "STEM"],
            collectorSource: "mit_ocw_rss",
            searchQuery:     "mit opencourseware",
          });
        }
      } catch (err) {
        console.warn(`[collector] MIT OCW RSS (${url}) failed:`, String(err));
      }
    }),
  );

  return results;
}

// ── D7 Source 8: YouTube EDU channels RSS ─────────────────────────────────────
//
// YouTube espone feed RSS pubblici per ogni canale:
//   https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID
//
// Canali selezionati per NorthStar (career + tech + crescita personale):
//   - TED-Ed         (UCsooa4yRKGN_zEE8iknghZA) — educazione generale
//   - Y Combinator   (UCcefcZRL2oaA_uBNeo5UNqg) — startup, carriera tech
//   - Fireship       (UCsBjURrPoezykLs9EqgamOA) — web dev, tech trends
//   - Ali Abdaal     (UCoOae5nYA7VqaXzerajD0lg) — produttività, carriera
//   - Thomas Frank   (UCG-KntY7aVnIGXYEBQvmBAQ) — studio, abitudini
//
// Tipo: formation | growth (dipende dal canale)
// Nessuna API key richiesta.

async function collectYouTubeEDU(): Promise<RawItem[]> {
  const channels: Array<{
    id:       string;
    name:     string;
    type:     ItemType;
    sector:   string;
    category: string;
  }> = [
    { id: "UCsooa4yRKGN_zEE8iknghZA", name: "TED-Ed",       type: "growth",      sector: "Education",          category: "educational_video" },
    { id: "UCcefcZRL2oaA_uBNeo5UNqg", name: "Y Combinator", type: "opportunity",  sector: "Startup",            category: "startup_advice" },
    { id: "UCsBjURrPoezykLs9EqgamOA", name: "Fireship",     type: "formation",   sector: "Technology",         category: "tech_tutorial" },
    { id: "UCoOae5nYA7VqaXzerajD0lg", name: "Ali Abdaal",   type: "growth",      sector: "Personal Development",category: "productivity" },
    { id: "UCG-KntY7aVnIGXYEBQvmBAQ", name: "Thomas Frank", type: "growth",      sector: "Personal Development",category: "study_habits" },
  ];

  const results: RawItem[] = [];

  await Promise.allSettled(
    channels.map(async ({ id, name, type, sector, category }) => {
      try {
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${id}`;
        const entries = await fetchRSS(feedUrl, 3); // 3 video recenti per canale
        for (const e of entries) {
          // YouTube URLs from RSS: https://www.youtube.com/watch?v=...
          // Extract thumbnail: YouTube RSS doesn't always include images;
          // fallback thumbnail URL from video ID
          const videoId  = new URL(e.url).searchParams.get("v");
          const imageUrl = e.imageUrl
            ?? (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : undefined);

          results.push({
            type,
            title:           e.title,
            url:             e.url,
            source:          `YouTube — ${name}`,
            summary:         e.summary || `Video di ${name}: ${e.title}`,
            imageUrl,
            publishedAt:     e.publishedAt,
            category,
            sectorNames:     [sector],
            collectorSource: "youtube_edu",
            searchQuery:     name,
          });
        }
      } catch (err) {
        console.warn(`[collector] YouTube RSS channel ${name} failed:`, String(err));
      }
    }),
  );

  return results;
}

// ── Bulk upsert (ON CONFLICT DO NOTHING) ──────────────────────────────────────

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
  const seen   = new Set<string>();
  const unique = rows.filter((r) => {
    if (seen.has(r.urlHash)) return false;
    seen.add(r.urlHash);
    return true;
  });

  // Chunk inserts (postgres max params safety)
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

// ── Main entry point ───────────────────────────────────────────────────────────

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
  const errors:   string[] = [];
  const allItems: RawItem[] = [];

  const sources: Array<{ name: string; fn: () => Promise<RawItem[]> }> = [
    // Fonti originali
    { name: "hackernews",    fn: collectHackerNews },
    { name: "devto",         fn: collectDevTo },
    { name: "reddit",        fn: collectReddit },
    { name: "newsapi",       fn: collectNewsAPI },
    // D7: fonti formazione certificata
    { name: "coursera_rss",  fn: collectCourseraRSS },
    { name: "udemy_rss",     fn: collectUdemyRSS },
    { name: "mit_ocw_rss",   fn: collectMITOpenCourseWare },
    { name: "youtube_edu",   fn: collectYouTubeEDU },
  ];

  await Promise.allSettled(
    sources.map(async ({ name, fn }) => {
      try {
        const items    = await fn();
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
