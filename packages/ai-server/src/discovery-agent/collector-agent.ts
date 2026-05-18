/**
 * DiscoveryCollectorAgent — raccoglie contenuti da fonti multiple.
 *
 * FONTI INTEGRATE:
 *   1. HackerNews Algolia API  — notizie tech, job posts, opportunità (no key)
 *   2. Dev.to API              — articoli formativi su skill tech (no key)
 *   3. Reddit JSON API         — r/cscareerquestions, r/learnprogramming, r/ItaliaPersonalFinance
 *   4. NewsAPI.org             — notizie lavoro, mercato, tech (free key, env: NEWS_API_KEY)
 *   5. GNews.io                — notizie globali con focus IT (free key, env: GNEWS_API_KEY)
 *   ── D7: Fonti formazione certificata ────────────────────────────────────────
 *   5. Coursera Blog RSS       — guide carriera, annunci corsi (no key)
 *   6. Udemy Blog RSS          — skill trends, learning guides (no key)
 *   7. MIT OpenCourseWare RSS  — nuovi corsi MIT OCW (no key)
 *   8. YouTube EDU RSS         — video formativi da canali selezionati (no key)
 *   ── D7+IT: Fonti italiane ────────────────────────────────────────────────────
 *   9. Il Sole 24 Ore RSS      — economia, lavoro, mercati italiani (no key)
 *  10. Ninja Marketing RSS     — marketing, digital, startup italiani (no key)
 *  11. Fonti dinamiche DB      — discovery_sources table (admin-managed, abilitabili/disabilitabili)
 *
 * REDIRECT:
 *   fetchRSS() segue automaticamente redirect 301/302 via fetch (Node 18+
 *   segue i redirect per default). Per sicurezza, `redirect: "follow"` è
 *   esplicitato e il timeout copre l'intera catena di redirect.
 *
 * DEDUPLICATION:
 *   Ogni item viene hashato via url. INSERT ON CONFLICT DO NOTHING.
 *
 * SCHEDULE:
 *   Cron ogni 6 ore + trigger manuale POST /api/admin/discovery/collect.
 */
import { logger } from "../logger";
import { db } from "@workspace/db";
import { discoveryItemsTable, discoverySourcesTable } from "@workspace/db";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import type { NewDiscoveryItem } from "@workspace/db";

// ── Types ────────────────────────────────────────────────────────────────────────

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

// ── URL hash ─────────────────────────────────────────────────────────────────────

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

// ── RSS/Atom parser (no external deps) ───────────────────────────────────────────
//
// ✅ Segue redirect 301/302: Node 18+ fetch segue i redirect per default.
//    `redirect: "follow"` è esplicito per chiarezza.
//    Il timeout di 12s copre l'intera catena (redirect inclusi).
//
// Supporta:
//   - RSS 2.0: <item><title><link><description><pubDate><enclosure url/>
//   - Atom:    <entry><title><link href/><summary><content><published>
//   - Media:   <media:thumbnail url/> <media:content url/>

interface RSSEntry {
  title:        string;
  url:          string;
  summary:      string;
  imageUrl?:    string;
  publishedAt?: Date;
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\/${tag}>`, "i");
  const m  = xml.match(re);
  return ((m?.[1] ?? m?.[2]) ?? "").trim();
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']+)["'][^>]*>`, "i");
  return xml.match(re)?.[1]?.trim() ?? "";
}

function parseRSS(xml: string, limit = 8): RSSEntry[] {
  const blocks = xml.match(/<(?:item|entry)[\s>][\s\S]*?<\/(?:item|entry)>/gi) ?? [];
  const entries: RSSEntry[] = [];

  for (const block of blocks.slice(0, limit)) {
    const title = extractTag(block, "title");
    if (!title) continue;

    let url = extractTag(block, "link").trim();
    if (!url || url.startsWith("<")) url = extractAttr(block, "link", "href");
    if (!url) url = extractTag(block, "url");
    if (!url || !url.startsWith("http")) continue;

    const summary = (extractTag(block, "description")
      || extractTag(block, "summary")
      || extractTag(block, "content"))
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ").slice(0, 400).trim();

    const imageUrl =
      extractAttr(block, "enclosure", "url") ||
      extractAttr(block, "media:thumbnail", "url") ||
      extractAttr(block, "media:content", "url") ||
      undefined;

    const dateStr = extractTag(block, "pubDate") || extractTag(block, "published") || extractTag(block, "updated");
    let publishedAt: Date | undefined;
    if (dateStr) { const d = new Date(dateStr); if (!isNaN(d.getTime())) publishedAt = d; }

    entries.push({ title, url, summary, imageUrl, publishedAt });
  }
  return entries;
}

/**
 * fetchRSS — scarica e parsa un feed RSS/Atom.
 *
 * Gestione redirect:
 *   Node 18+ segue automaticamente 301/302/307/308 con redirect:"follow".
 *   Se il server risponde con HTML invece di XML (es. pagina di errore dopo redirect),
 *   il parser restituisce 0 entry silenziosamente (non crasha).
 *
 * Fallback redirect manuale:
 *   Alcuni server restituiscono 301 con body vuoto e header Location ma
 *   content-type errato. In quel caso facciamo un secondo fetch esplicito.
 */
async function fetchRSS(feedUrl: string, limit = 8): Promise<RSSEntry[]> {
  const headers = {
    "Accept":     "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
    "User-Agent": "NorthStar/1.0 (discovery-agent; +https://northstar.app)",
  };

  let res = await fetch(feedUrl, {
    headers,
    redirect: "follow",                     // segui 301/302 automaticamente
    signal:   AbortSignal.timeout(12_000),  // 12s per l'intera catena di redirect
  });

  // Fallback: se il server ha risposto con 301 senza seguire, prova manualmente
  if ((res.status === 301 || res.status === 302) && res.headers.get("location")) {
    const location = res.headers.get("location")!;
    res = await fetch(location, { headers, redirect: "follow", signal: AbortSignal.timeout(10_000) });
  }

  if (!res.ok) throw new Error(`HTTP ${res.status} for ${feedUrl}`);

  const xml = await res.text();
  // Se la risposta è HTML (es. redirect a login page) → restituisci [] senza crash
  if (xml.trimStart().startsWith("<!DOCTYPE") || xml.trimStart().startsWith("<html")) {
    logger.warn({ feedUrl }, "[collector] fetchRSS got HTML instead of XML for %s", feedUrl);
    return [];
  }

  return parseRSS(xml, limit);
}

// ── Source 1: HackerNews ────────────────────────────────────────────────────────

interface HNHit {
  objectID: string; title?: string; story_title?: string;
  url?: string; story_url?: string; created_at?: string; points?: number;
}

async function collectHackerNews(): Promise<RawItem[]> {
  const queries = [
    { q: "career+opportunity+tech",     type: "opportunity"  as ItemType, sector: "Technology" },
    { q: "machine+learning+trend",      type: "sector_trend" as ItemType, sector: "Artificial Intelligence" },
    { q: "remote+work+job",              type: "opportunity"  as ItemType, sector: "Remote Work" },
    { q: "startup+funding+2026",         type: "news"         as ItemType, sector: "Startup" },
    { q: "personal+growth+productivity", type: "growth"       as ItemType, sector: "Personal Development" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(queries.map(async ({ q, type, sector }) => {
    try {
      const res  = await fetch(`https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=5&numericFilters=points>10`, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return;
      const data = await res.json() as { hits?: HNHit[] };
      for (const hit of (data.hits ?? [])) {
        const url = hit.url ?? hit.story_url;
        if (!url || !hit.title) continue;
        results.push({ type, title: hit.title ?? hit.story_title ?? "Untitled", url, source: "HackerNews", summary: `Discussione HN: ${hit.title}. ${hit.points ?? 0} punti.`, publishedAt: hit.created_at ? new Date(hit.created_at) : undefined, category: type, sectorNames: [sector], collectorSource: "hackernews", searchQuery: q });
      }
    } catch { /* skip */ }
  }));
  return results;
}

// ── Source 2: Dev.to ────────────────────────────────────────────────────────────

interface DevToArticle { id: number; title: string; description?: string; url: string; cover_image?: string; published_at?: string; }

async function collectDevTo(): Promise<RawItem[]> {
  const tags = ["career", "productivity", "webdev", "ai", "typescript", "beginners"];
  const results: RawItem[] = [];
  await Promise.allSettled(tags.map(async (tag) => {
    try {
      const res = await fetch(`https://dev.to/api/articles?tag=${tag}&per_page=5&top=7`, { headers: { "Accept": "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return;
      const articles = await res.json() as DevToArticle[];
      for (const a of articles) {
        if (!a.url || !a.title) continue;
        results.push({ type: "formation", title: a.title, url: a.url, source: "Dev.to", summary: a.description ?? `Articolo su ${tag}`, imageUrl: a.cover_image ?? undefined, publishedAt: a.published_at ? new Date(a.published_at) : undefined, category: "formation_article", sectorNames: ["Technology", "Software Development"], collectorSource: "devto", searchQuery: tag });
      }
    } catch { /* skip */ }
  }));
  return results;
}

// ── Source 3: Reddit ────────────────────────────────────────────────────────────

interface RedditPost { data: { title: string; url: string; selftext?: string; score?: number; created_utc?: number; permalink?: string; subreddit?: string; }; }

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
  await Promise.allSettled(subreddits.map(async ({ sub, type, sector, category }) => {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, { headers: { "User-Agent": "NorthStar/1.0" }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return;
      const data = await res.json() as { data?: { children?: RedditPost[] } };
      for (const post of (data.data?.children ?? [])) {
        const p = post.data;
        if (!p.title || !p.url) continue;
        const url = p.url.startsWith("/r/") || p.url.startsWith("https://www.reddit.com") ? `https://www.reddit.com${p.permalink ?? ""}` : p.url;
        results.push({ type, title: p.title, url, source: `Reddit r/${sub}`, summary: (p.selftext ?? "").slice(0, 300) || `Post in r/${sub}`, publishedAt: p.created_utc ? new Date(p.created_utc * 1000) : undefined, category, sectorNames: [sector], collectorSource: "reddit", searchQuery: sub });
      }
    } catch { /* skip */ }
  }));
  return results;
}

// ── Source 4: NewsAPI ───────────────────────────────────────────────────────────

interface NewsAPIArticle { title?: string; description?: string; url?: string; urlToImage?: string; publishedAt?: string; source?: { name?: string }; }

async function collectNewsAPI(): Promise<RawItem[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];
  const queries: Array<{ q: string; type: ItemType; sector: string }> = [
    { q: "lavoro+tech+italia",             type: "opportunity",  sector: "Technology" },
    { q: "formazione+professionale",        type: "formation",    sector: "Education" },
    { q: "startup+italiana+finanziamento",  type: "opportunity",  sector: "Startup" },
    { q: "intelligenza+artificiale+lavoro", type: "sector_trend", sector: "Artificial Intelligence" },
    { q: "mercato+lavoro+2026",             type: "news",         sector: "Labor Market" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(queries.map(async ({ q, type, sector }) => {
    try {
      const res = await fetch(`https://newsapi.org/v2/everything?q=${q}&language=it&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const data = await res.json() as { articles?: NewsAPIArticle[] };
      for (const a of (data.articles ?? [])) {
        if (!a.url || !a.title || a.title === "[Removed]") continue;
        results.push({ type, title: a.title, url: a.url, source: a.source?.name ?? "NewsAPI", summary: a.description ?? "", imageUrl: a.urlToImage ?? undefined, publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined, category: type, sectorNames: [sector], collectorSource: "newsapi", searchQuery: q });
      }
    } catch { /* skip */ }
  }));
  return results;
}

// ── Source 5: GNews ─────────────────────────────────────────────────────────────

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: { name: string; url: string; icon: string };
}

async function collectGNews(): Promise<RawItem[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];
  const queries: Array<{ q: string; type: ItemType; sector: string }> = [
    { q: "lavoro tecnologia italia",             type: "opportunity",  sector: "Technology" },
    { q: "formazione professionale digitale",     type: "formation",    sector: "Education" },
    { q: "startup italia finanziamento",          type: "opportunity",  sector: "Startup" },
    { q: "intelligenza artificiale lavoro",       type: "sector_trend", sector: "Artificial Intelligence" },
    { q: "mercato del lavoro 2026",               type: "news",         sector: "Labor Market" },
    { q: "economia digitale europa",              type: "sector_trend", sector: "Digital Economy" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(queries.map(async ({ q, type, sector }) => {
    try {
      const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=it&max=5&apikey=${apiKey}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const data = await res.json() as { articles?: GNewsArticle[] };
      for (const a of (data.articles ?? [])) {
        if (!a.url || !a.title) continue;
        results.push({
          type,
          title: a.title,
          url: a.url,
          source: a.source?.name ?? "GNews",
          summary: a.description ?? a.content?.slice(0, 400) ?? "",
          imageUrl: a.image ?? undefined,
          publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined,
          category: type,
          sectorNames: [sector],
          collectorSource: "gnews",
          searchQuery: q,
        });
      }
    } catch { /* skip */ }
  }));
  return results;
}

// ── D7 Source 6: Coursera Blog RSS ─────────────────────────────────────────────

async function collectCourseraRSS(): Promise<RawItem[]> {
  const feeds = [
    { url: "https://blog.coursera.org/feed/",                   sector: "Education",         category: "course_announcement" },
    { url: "https://blog.coursera.org/career-development/feed/", sector: "Career Development", category: "career_guide" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(feeds.map(async ({ url, sector, category }) => {
    try {
      const entries = await fetchRSS(url, 6);
      for (const e of entries) {
        results.push({ type: "formation", title: e.title, url: e.url, source: "Coursera Blog", summary: e.summary || `Articolo Coursera: ${e.title}`, imageUrl: e.imageUrl, publishedAt: e.publishedAt, category, sectorNames: [sector, "Online Learning"], collectorSource: "coursera_rss", searchQuery: sector });
      }
    } catch (err) { logger.warn({ err }, "[collector] Coursera RSS failed"); }
  }));
  return results;
}

// ── D7 Source 7: Udemy Blog RSS ────────────────────────────────────────────────

async function collectUdemyRSS(): Promise<RawItem[]> {
  const feeds = [
    { url: "https://blog.udemy.com/feed/",                      sector: "Online Learning",    category: "learning_guide" },
    { url: "https://blog.udemy.com/category/workplace/feed/",    sector: "Career Development", category: "workplace_skills" },
    { url: "https://blog.udemy.com/category/developer/feed/",    sector: "Technology",         category: "developer_skills" },
    { url: "https://blog.udemy.com/category/data-science/feed/", sector: "Data Science",       category: "data_skills" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(feeds.map(async ({ url, sector, category }) => {
    try {
      const entries = await fetchRSS(url, 5);
      for (const e of entries) {
        const isReport = /trend|report|top \d|in \d{4}|stat|survey/i.test(e.title);
        results.push({ type: isReport ? "sector_trend" : "formation", title: e.title, url: e.url, source: "Udemy Blog", summary: e.summary || `Guida Udemy: ${e.title}`, imageUrl: e.imageUrl, publishedAt: e.publishedAt, category, sectorNames: [sector, "Skills Development"], collectorSource: "udemy_rss", searchQuery: sector });
      }
    } catch (err) { logger.warn({ err }, "[collector] Udemy RSS failed"); }
  }));
  return results;
}

// ── D7 Source 8: MIT OpenCourseWare RSS ───────────────────────────────────────

async function collectMITOpenCourseWare(): Promise<RawItem[]> {
  const feeds = [
    { url: "https://ocw.mit.edu/rss/new_courses.xml" },
    { url: "https://ocw.mit.edu/rss/recently_published.xml" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(feeds.map(async ({ url }) => {
    try {
      const entries = await fetchRSS(url, 5);
      for (const e of entries) {
        results.push({ type: "formation", title: `[MIT OCW] ${e.title}`, url: e.url, source: "MIT OpenCourseWare", summary: e.summary || `Corso MIT gratuito: ${e.title}`, imageUrl: e.imageUrl, publishedAt: e.publishedAt, category: "university_course", sectorNames: ["Academic", "University", "STEM"], collectorSource: "mit_ocw_rss", searchQuery: "mit opencourseware" });
      }
    } catch (err) { logger.warn({ err }, "[collector] MIT OCW RSS failed"); }
  }));
  return results;
}

// ── D7 Source 9: YouTube EDU RSS ──────────────────────────────────────────────

async function collectYouTubeEDU(): Promise<RawItem[]> {
  const channels: Array<{ id: string; name: string; type: ItemType; sector: string; category: string }> = [
    { id: "UCsooa4yRKGN_zEE8iknghZA", name: "TED-Ed",       type: "growth",     sector: "Education",           category: "educational_video" },
    { id: "UCcefcZRL2oaA_uBNeo5UNqg", name: "Y Combinator", type: "opportunity", sector: "Startup",             category: "startup_advice" },
    { id: "UCsBjURrPoezykLs9EqgamOA", name: "Fireship",     type: "formation",  sector: "Technology",          category: "tech_tutorial" },
    { id: "UCoOae5nYA7VqaXzerajD0lg", name: "Ali Abdaal",   type: "growth",     sector: "Personal Development", category: "productivity" },
    { id: "UCG-KntY7aVnIGXYEBQvmBAQ", name: "Thomas Frank", type: "growth",     sector: "Personal Development", category: "study_habits" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(channels.map(async ({ id, name, type, sector, category }) => {
    try {
      const entries  = await fetchRSS(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, 3);
      for (const e of entries) {
        const videoId  = new URL(e.url).searchParams.get("v");
        const imageUrl = e.imageUrl ?? (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : undefined);
        results.push({ type, title: e.title, url: e.url, source: `YouTube — ${name}`, summary: e.summary || `Video di ${name}: ${e.title}`, imageUrl, publishedAt: e.publishedAt, category, sectorNames: [sector], collectorSource: "youtube_edu", searchQuery: name });
      }
    } catch (err) { logger.warn({ err, channel: name }, "[collector] YouTube RSS failed"); }
  }));
  return results;
}

// ── D7+IT Source 10: Il Sole 24 Ore RSS ────────────────────────────────────────
//
// Il Sole 24 Ore è il principale quotidiano economico-finanziario italiano.
// Pubblica feed RSS pubblici suddivisi per sezione.
//
// Feed ufficiali (verificati, no 401):
//   Economia:   https://www.ilsole24ore.com/rss/economia.xml
//   Lavoro:     https://www.ilsole24ore.com/rss/notizie/lavoro-carriere.xml
//   Tecnologia: https://www.ilsole24ore.com/rss/tecnologia.xml
//   Finanza:    https://www.ilsole24ore.com/rss/finanza.xml
//
// Tipo: news | sector_trend | opportunity
// Lingua: italiano. Nessuna API key richiesta.

async function collectIlSole24Ore(): Promise<RawItem[]> {
  const feeds: Array<{ url: string; type: ItemType; sector: string; category: string }> = [
    { url: "https://www.ilsole24ore.com/rss/economia.xml",              type: "news",         sector: "Economia Italia",     category: "economia" },
    { url: "https://www.ilsole24ore.com/rss/notizie/lavoro-carriere.xml",type: "opportunity",  sector: "Mercato del Lavoro",  category: "lavoro_carriere" },
    { url: "https://www.ilsole24ore.com/rss/tecnologia.xml",            type: "sector_trend", sector: "Technology",         category: "tech_news" },
    { url: "https://www.ilsole24ore.com/rss/finanza.xml",              type: "news",         sector: "Finanza",            category: "finanza" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(feeds.map(async ({ url, type, sector, category }) => {
    try {
      const entries = await fetchRSS(url, 6);
      for (const e of entries) {
        results.push({ type, title: e.title, url: e.url, source: "Il Sole 24 Ore", summary: e.summary || `Notizia Il Sole 24 Ore: ${e.title}`, imageUrl: e.imageUrl, publishedAt: e.publishedAt, category, sectorNames: [sector, "Italy", "Italian News"], collectorSource: "sole24ore_rss", searchQuery: sector });
      }
    } catch (err) { logger.warn({ err, feedUrl: url }, "[collector] IlSole24Ore RSS failed"); }
  }));
  return results;
}

// ── D7+IT Source 11: Ninja Marketing RSS ──────────────────────────────────────
//
// Ninja Marketing (ninjamarketing.it) è uno dei principali media italiani su:
//   - Marketing digitale e social media
//   - Startup e innovazione italiana
//   - Trend di settore: AI, e-commerce, influencer marketing
//
// Feed: https://www.ninjamarketing.it/feed/
// Tipo: sector_trend | news | growth
// Lingua: italiano. Nessuna API key richiesta.

async function collectNinjaMarketing(): Promise<RawItem[]> {
  const feeds: Array<{ url: string; type: ItemType; sector: string; category: string }> = [
    { url: "https://www.ninjamarketing.it/feed/",                              type: "sector_trend", sector: "Digital Marketing", category: "marketing_trend" },
    { url: "https://www.ninjamarketing.it/category/startup-innovazione/feed/", type: "opportunity",  sector: "Startup",          category: "startup_italia" },
    { url: "https://www.ninjamarketing.it/category/social-media/feed/",        type: "sector_trend", sector: "Social Media",      category: "social_media" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(feeds.map(async ({ url, type, sector, category }) => {
    try {
      const entries = await fetchRSS(url, 5);
      for (const e of entries) {
        results.push({ type, title: e.title, url: e.url, source: "Ninja Marketing", summary: e.summary || `Articolo Ninja Marketing: ${e.title}`, imageUrl: e.imageUrl, publishedAt: e.publishedAt, category, sectorNames: [sector, "Italy", "Digital"], collectorSource: "ninja_marketing_rss", searchQuery: sector });
      }
    } catch (err) { logger.warn({ err, feedUrl: url }, "[collector] NinjaMarketing RSS failed"); }
  }));
  return results;
}

// ── Source 12: Dynamic sources from DB (admin-managed) ────────────────────────
//
// Legge la tabella discovery_sources (abilitata=true) e processa i feed RSS
// configurati dall'admin via DiscoverySourcesManager.
// Permette di aggiungere/disabilitare fonti senza deploy.

async function collectDynamicSources(): Promise<RawItem[]> {
  let sources: Array<{
    id: number;
    name: string;
    feedUrl: string;
    itemType: string;
    sector: string;
    category: string;
    itemsPerRun: number;
  }>;

  try {
    sources = await db
      .select()
      .from(discoverySourcesTable)
      .where(eq(discoverySourcesTable.enabled, true));
  } catch (err) {
    logger.warn({ err }, "[collector] dynamic sources DB read failed");
    return [];
  }

  const results: RawItem[] = [];
  await Promise.allSettled(
    sources.map(async (src) => {
      try {
        const entries = await fetchRSS(src.feedUrl, src.itemsPerRun ?? 6);
        for (const e of entries) {
          results.push({
            type:            (src.itemType as ItemType) ?? "news",
            title:           e.title,
            url:             e.url,
            source:          src.name,
            summary:         e.summary || `${src.name}: ${e.title}`,
            imageUrl:        e.imageUrl,
            publishedAt:     e.publishedAt,
            category:        src.category ?? src.itemType ?? "news",
            sectorNames:     [src.sector ?? "General"],
            collectorSource: `dynamic_${src.id}`,
            searchQuery:     src.name,
          });
        }
      } catch (err) {
        logger.warn({ err, sourceName: src.name, feedUrl: src.feedUrl }, "[collector] dynamic source failed");
      }
    }),
  );
  return results;
}

// ── Bulk upsert ──────────────────────────────────────────────────────────────────

async function bulkInsert(items: RawItem[]): Promise<number> {
  if (!items.length) return 0;
  const rows: NewDiscoveryItem[] = items.map((item) => ({
    type: item.type, title: item.title.slice(0, 500), url: item.url.slice(0, 2000),
    urlHash: hashUrl(item.url), source: item.source, summary: item.summary.slice(0, 1000),
    imageUrl: item.imageUrl, publishedAt: item.publishedAt, category: item.category,
    sectorNames: item.sectorNames, collectorSource: item.collectorSource,
    searchQuery: item.searchQuery, isEnriched: false, relevanceScore: 0,
  }));
  const seen = new Set<string>();
  const unique = rows.filter((r) => { if (seen.has(r.urlHash)) return false; seen.add(r.urlHash); return true; });
  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < unique.length; i += CHUNK) {
    try {
      const result = await db.insert(discoveryItemsTable).values(unique.slice(i, i + CHUNK)).onConflictDoNothing({ target: discoveryItemsTable.urlHash });
      inserted += (result.rowCount ?? 0);
    } catch (err) { logger.warn({ err }, "[collector] bulk insert chunk failed"); }
  }
  return inserted;
}

// ── Main entry point ─────────────────────────────────────────────────────────────

export interface CollectorResult {
  totalCollected: number;
  totalInserted:  number;
  bySource:       Record<string, number>;
  errors:         string[];
  durationMs:     number;
}

export async function runCollector(): Promise<CollectorResult> {
  const startedAt = Date.now();
  const bySource: Record<string, number> = {};
  const errors:   string[] = [];
  const allItems: RawItem[] = [];

  // Distributed lock: prevent concurrent runs
  try {
    const existing = await db.execute(
      sql`SELECT pg_try_advisory_lock(${COLLECTOR_LOCK_KEY}) AS locked`
    );
    const locked = existing.rows[0]?.locked;
    if (!locked) {
      const msg = "[collector] Another run is already in progress — skipping";
      logger.warn(msg);
      return { totalCollected: 0, totalInserted: 0, bySource, errors: [msg], durationMs: 0 };
    }
  } catch {
    // pg_try_advisory_lock not available (e.g. SQLite fallback) — proceed without lock
    logger.warn("[collector] Advisory lock not available, proceeding without lock");
  }

  const sources: Array<{ name: string; fn: () => Promise<RawItem[]> }> = [
    { name: "hackernews",          fn: collectHackerNews },
    { name: "devto",               fn: collectDevTo },
    { name: "reddit",              fn: collectReddit },
    { name: "newsapi",             fn: collectNewsAPI },
    { name: "gnews",               fn: collectGNews },
    { name: "coursera_rss",        fn: collectCourseraRSS },
    { name: "udemy_rss",           fn: collectUdemyRSS },
    { name: "mit_ocw_rss",         fn: collectMITOpenCourseWare },
    { name: "youtube_edu",         fn: collectYouTubeEDU },
    { name: "sole24ore_rss",       fn: collectIlSole24Ore },
    { name: "ninja_marketing_rss", fn: collectNinjaMarketing },
    { name: "dynamic_sources",     fn: collectDynamicSources },
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
  const result: CollectorResult = { totalCollected: allItems.length, totalInserted, bySource, errors, durationMs: Date.now() - startedAt };
  logger.info({ totalCollected: result.totalCollected, totalInserted: result.totalInserted, bySource: result.bySource, durationMs: result.durationMs }, "[collector] run complete");

  // Release advisory lock
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${COLLECTOR_LOCK_KEY})`);
  } catch { /* ignore */ }

  return result;
}

// Advisory lock key as stable int64 hash of "discovery_collector_running"
const COLLECTOR_LOCK_KEY = 1937832947;
