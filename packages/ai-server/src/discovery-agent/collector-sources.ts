import { and, eq } from "drizzle-orm";
import { db, discoverySourcesTable } from "@workspace/db";
import { logger } from "../logger";
import { fetchRSS } from "./collector-rss";
import { collectScrapingSources } from "./collector-scraping";
import type { CollectorSource, ItemType, RawItem } from "./collector-types";

interface HNHit {
  objectID: string;
  title?: string;
  story_title?: string;
  url?: string;
  story_url?: string;
  created_at?: string;
  points?: number;
}

interface DevToArticle {
  id: number;
  title: string;
  description?: string;
  url: string;
  cover_image?: string;
  published_at?: string;
}

interface RedditPost {
  data: { title: string; url: string; selftext?: string; score?: number; created_utc?: number; permalink?: string; subreddit?: string };
}

interface NewsAPIArticle {
  title?: string;
  description?: string;
  url?: string;
  urlToImage?: string;
  publishedAt?: string;
  source?: { name?: string };
}

interface GNewsArticle {
  title: string;
  description: string;
  content: string;
  url: string;
  image: string;
  publishedAt: string;
  source: { name: string; url: string; icon: string };
}

interface TavilySearchResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  raw_content?: string;
}

interface ItalianLaborNewsQuery {
  q: string;
  type: "news";
  sector: string;
  category: string;
}

type SectorClassifierRule = {
  sector: string;
  keywords: string[];
};

const ITALIAN_NEWS_HOST_HINTS = [
  ".it/",
  "ansa.it",
  "ilsole24ore.com",
  "repubblica.it",
  "wired.it",
  "ninjamarketing.it",
  "corriere.it",
  "lastampa.it",
  "fanpage.it",
  "startupitalia.eu",
];

const ITALIAN_TEXT_HINTS = [
  "lavoro",
  "lavoratori",
  "occupazione",
  "professioni",
  "professionale",
  "competenze",
  "formazione",
  "carriere",
  "aziende",
  "imprese",
  "mercato",
  "settore",
  "italia",
  "italiano",
  "italiana",
  "digitale",
  "sanita",
  "sostenibilita",
];

const ENGLISH_TEXT_HINTS = [
  "workforce",
  "workers",
  "skills",
  "companies",
  "leaders",
  "employment",
  "career",
  "training",
  "market",
];

const SECTOR_CLASSIFIER_RULES: SectorClassifierRule[] = [
  {
    sector: "Tecnologia & Software",
    keywords: ["software", "digitale", "digitali", "programmat", "developer", "svilupp", "cloud", "dati", "server", "data center", "semiconductor", "chip"],
  },
  {
    sector: "AI & Automazione",
    keywords: ["intelligenza artificiale", "openai", "automazione", "robot", "algoritm", "machine learning", "generativa", "chatbot"],
  },
  {
    sector: "Sanita & Life Sciences",
    keywords: ["sanita", "sanitario", "ospedal", "medic", "farmaceutic", "life science", "biotech", "salute", "infermier"],
  },
  {
    sector: "Energia & Sostenibilita",
    keywords: ["energia", "rinnovabil", "sostenibil", "green", "clima", "ambient", "fotovoltaic", "eolic", "transizione"],
  },
  {
    sector: "Finanza & Fintech",
    keywords: ["banca", "banche", "finanza", "fintech", "borsa", "credito", "pagamenti", "assicur", "investiment"],
  },
  {
    sector: "Marketing & Comunicazione",
    keywords: ["marketing", "comunicazione", "pubblicit", "brand", "social media", "media", "creator", "advertising"],
  },
  {
    sector: "Design & UX",
    keywords: ["design", "ux", "prodotto digitale", "interfac", "user experience", "creativ"],
  },
  {
    sector: "Educazione & Formazione",
    keywords: ["formazione", "scuola", "universit", "competenze", "upskilling", "reskilling", "student", "academy", "corso"],
  },
  {
    sector: "Logistica & Supply Chain",
    keywords: ["logistica", "trasport", "supply chain", "spedizion", "magazzin", "ferrov", "intercity"],
  },
  {
    sector: "Turismo & Hospitality",
    keywords: ["turismo", "hotel", "hospitality", "ristor", "viaggi", "stagione", "parchi acquatici", "accoglienza"],
  },
  {
    sector: "Cybersecurity",
    keywords: ["cyber", "sicurezza informatica", "hacker", "ransomware", "data breach", "privacy"],
  },
  {
    sector: "Media & Intrattenimento",
    keywords: ["intrattenimento", "cinema", "streaming", "musica", "editoria", "giornal", "contenut"],
  },
];

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyItalianLaborSectors(input: { title?: string; summary?: string; fallbackSector?: string }): string[] {
  const rawText = `${input.title ?? ""} ${input.summary ?? ""}`;
  const text = ` ${normalizeSearchText(rawText)} `;
  const keywordMatches = (keyword: string) => {
    const normalizedKeyword = normalizeSearchText(keyword);
    if (normalizedKeyword.length <= 2) return new RegExp(`\\b${normalizedKeyword}\\b`).test(text);
    return text.includes(normalizedKeyword);
  };
  const matches = SECTOR_CLASSIFIER_RULES
    .map((rule) => ({
      sector: rule.sector,
      score: rule.keywords.reduce((score, keyword) => score + (keywordMatches(keyword) ? 1 : 0), 0)
        + (rule.sector === "AI & Automazione" && /\bAI\b/.test(rawText) ? 1 : 0),
    }))
    .filter((match) => match.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((match) => match.sector);

  if (matches.length > 0) return matches;
  const fallbackMap: Record<string, string> = {
    Technology: "Tecnologia & Software",
    Finanza: "Finanza & Fintech",
    "Digital Marketing": "Marketing & Comunicazione",
    "Economia Italia": "Mercato del Lavoro",
  };
  const fallback = input.fallbackSector ? (fallbackMap[input.fallbackSector] ?? input.fallbackSector) : "Mercato del Lavoro";
  return [fallback];
}

export function isItalianLaborNewsText(input: { title?: string; summary?: string; url?: string }): boolean {
  const url = String(input.url ?? "").toLowerCase();
  const text = normalizeSearchText(`${input.title ?? ""} ${input.summary ?? ""}`);
  const hostScore = ITALIAN_NEWS_HOST_HINTS.some((hint) => url.includes(hint)) ? 2 : 0;
  const accentScore = /[àèéìòù]/i.test(`${input.title ?? ""} ${input.summary ?? ""}`) ? 1 : 0;
  const italianScore = ITALIAN_TEXT_HINTS.reduce((score, hint) => score + (text.includes(hint) ? 1 : 0), 0);
  const englishScore = ENGLISH_TEXT_HINTS.reduce((score, hint) => score + (text.includes(hint) ? 1 : 0), 0);

  return hostScore + accentScore + italianScore >= 3 && italianScore >= Math.max(1, englishScore - 2);
}

export function getItalianLaborNewsQueries(): ItalianLaborNewsQuery[] {
  return [
    { q: "lavoro tecnologia software competenze digitali Italia", type: "news", sector: "Tecnologia & Software", category: "tech_lavoro" },
    { q: "lavoro intelligenza artificiale professioni competenze Italia", type: "news", sector: "AI & Automazione", category: "ai_lavoro" },
    { q: "lavoro sanita life sciences professioni Italia", type: "news", sector: "Sanita & Life Sciences", category: "sanita_lavoro" },
    { q: "lavoro energia sostenibilita green jobs Italia", type: "news", sector: "Energia & Sostenibilita", category: "energia_lavoro" },
    { q: "lavoro finanza fintech banche competenze Italia", type: "news", sector: "Finanza & Fintech", category: "finanza_lavoro" },
    { q: "lavoro marketing comunicazione digitale Italia", type: "news", sector: "Marketing & Comunicazione", category: "marketing_lavoro" },
    { q: "lavoro design UX prodotto digitale Italia", type: "news", sector: "Design & UX", category: "design_lavoro" },
    { q: "lavoro formazione education competenze professionali Italia", type: "news", sector: "Educazione & Formazione", category: "education_lavoro" },
    { q: "lavoro logistica supply chain professioni Italia", type: "news", sector: "Logistica & Supply Chain", category: "logistica_lavoro" },
    { q: "lavoro turismo hospitality professioni Italia", type: "news", sector: "Turismo & Hospitality", category: "turismo_lavoro" },
    { q: "lavoro cybersecurity sicurezza informatica competenze Italia", type: "news", sector: "Cybersecurity", category: "cybersecurity_lavoro" },
    { q: "lavoro media intrattenimento creator economy Italia", type: "news", sector: "Media & Intrattenimento", category: "media_lavoro" },
  ];
}

async function collectHackerNews(): Promise<RawItem[]> {
  const queries = [
    { q: "career+opportunity+tech", type: "opportunity" as ItemType, sector: "Technology" },
    { q: "machine+learning+trend", type: "sector_trend" as ItemType, sector: "Artificial Intelligence" },
    { q: "remote+work+job", type: "opportunity" as ItemType, sector: "Remote Work" },
    { q: "startup+funding+2026", type: "news" as ItemType, sector: "Startup" },
    { q: "personal+growth+productivity", type: "growth" as ItemType, sector: "Personal Development" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(queries.map(async ({ q, type, sector }) => {
    try {
      const res = await fetch(`https://hn.algolia.com/api/v1/search?query=${q}&tags=story&hitsPerPage=5&numericFilters=points>10`, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return;
      const data = await res.json() as { hits?: HNHit[] };
      for (const hit of data.hits ?? []) {
        const url = hit.url ?? hit.story_url;
        const title = hit.title ?? hit.story_title;
        if (!url || !title) continue;
        results.push({ type, title, url, source: "HackerNews", summary: `Discussione HN: ${title}. ${hit.points ?? 0} punti.`, publishedAt: hit.created_at ? new Date(hit.created_at) : undefined, category: type, sectorNames: [sector], collectorSource: "hackernews", searchQuery: q });
      }
    } catch { /* skip */ }
  }));
  return results;
}

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

async function collectReddit(): Promise<RawItem[]> {
  const subreddits: Array<{ sub: string; type: ItemType; sector: string; category: string }> = [
    { sub: "cscareerquestions", type: "opportunity", sector: "Technology", category: "career_advice" },
    { sub: "learnprogramming", type: "formation", sector: "Software Development", category: "learning_resource" },
    { sub: "ItaliaPersonalFinance", type: "growth", sector: "Personal Finance", category: "finance_advice" },
    { sub: "personalfinance", type: "growth", sector: "Personal Finance", category: "finance_advice" },
    { sub: "getdisciplined", type: "growth", sector: "Personal Development", category: "habits_productivity" },
    { sub: "italy", type: "news", sector: "Italy", category: "local_news" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(subreddits.map(async ({ sub, type, sector, category }) => {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=5`, { headers: { "User-Agent": "NorthStar/1.0" }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return;
      const data = await res.json() as { data?: { children?: RedditPost[] } };
      for (const post of data.data?.children ?? []) {
        const p = post.data;
        if (!p.title || !p.url) continue;
        const url = p.url.startsWith("/r/") || p.url.startsWith("https://www.reddit.com") ? `https://www.reddit.com${p.permalink ?? ""}` : p.url;
        results.push({ type, title: p.title, url, source: `Reddit r/${sub}`, summary: (p.selftext ?? "").slice(0, 300) || `Post in r/${sub}`, publishedAt: p.created_utc ? new Date(p.created_utc * 1000) : undefined, category, sectorNames: [sector], collectorSource: "reddit", searchQuery: sub });
      }
    } catch { /* skip */ }
  }));
  return results;
}

async function collectNewsAPI(): Promise<RawItem[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) return [];
  const queries = getItalianLaborNewsQueries();
  const results: RawItem[] = [];
  await Promise.allSettled(queries.map(async ({ q, type, sector, category }) => {
    try {
      const res = await fetch(`https://newsapi.org/v2/everything?q=${encodeURIComponent(q)}&language=it&sortBy=publishedAt&pageSize=5&apiKey=${apiKey}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return;
      const data = await res.json() as { articles?: NewsAPIArticle[] };
      for (const a of data.articles ?? []) {
        if (!a.url || !a.title || a.title === "[Removed]") continue;
        results.push({ type, title: a.title, url: a.url, source: a.source?.name ?? "NewsAPI", summary: a.description ?? "", imageUrl: a.urlToImage ?? undefined, publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined, category, sectorNames: [sector], collectorSource: "newsapi", searchQuery: q });
      }
    } catch { /* skip */ }
  }));
  return results;
}

async function collectGNews(): Promise<RawItem[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];
  const maxQueries = Number(process.env.GNEWS_NEWS_MAX_QUERIES) || 4;
  const queries = getItalianLaborNewsQueries().slice(0, maxQueries);
  const results: RawItem[] = [];
  for (const { q, type, sector, category } of queries) {
    try {
      const res = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(q)}&lang=it&max=3&apikey=${apiKey}`, { signal: AbortSignal.timeout(10_000) });
      if (res.status === 429) break;
      if (!res.ok) continue;
      const data = await res.json() as { articles?: GNewsArticle[] };
      for (const a of data.articles ?? []) {
        if (!a.url || !a.title) continue;
        const summary = a.description ?? a.content?.slice(0, 400) ?? "";
        if (!isItalianLaborNewsText({ title: a.title, summary, url: a.url })) continue;
        results.push({ type, title: a.title, url: a.url, source: a.source?.name ?? "GNews", summary, imageUrl: a.image ?? undefined, publishedAt: a.publishedAt ? new Date(a.publishedAt) : undefined, category, sectorNames: classifyItalianLaborSectors({ title: a.title, summary, fallbackSector: sector }), collectorSource: "gnews", searchQuery: q });
      }
    } catch { /* skip */ }
  }
  return results;
}

async function collectTavilyNews(): Promise<RawItem[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  const maxQueries = Number(process.env.TAVILY_NEWS_MAX_QUERIES) || 6;
  const queries = getItalianLaborNewsQueries().slice(0, maxQueries);
  const results: RawItem[] = [];
  for (const { q, type, sector, category } of queries) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: `${q} notizie recenti`,
          search_depth: "advanced",
          topic: "news",
          days: 14,
          max_results: 2,
          include_raw_content: false,
          search_lang: "it",
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.status === 429 || res.status === 432) break;
      if (!res.ok) continue;
      const data = await res.json() as { results?: TavilySearchResult[] };
      for (const item of data.results ?? []) {
        if (!item.url || !item.title) continue;
        const summary = item.content ?? item.raw_content?.slice(0, 500) ?? "";
        if (!isItalianLaborNewsText({ title: item.title, summary, url: item.url })) continue;
        results.push({
          type,
          title: item.title,
          url: item.url,
          source: "Tavily",
          summary,
          publishedAt: new Date(),
          category,
          sectorNames: classifyItalianLaborSectors({ title: item.title, summary, fallbackSector: sector }),
          collectorSource: "tavily_news",
          searchQuery: q,
        });
      }
    } catch { /* skip */ }
  }
  return results;
}

async function collectStaticRssSources(priorityOnly = false): Promise<RawItem[]> {
  const feeds: Array<{ url: string; type: ItemType; source: string; sector: string; category: string; collectorSource: string; limit?: number }> = [
    { url: "https://blog.coursera.org/feed/", type: "formation", source: "Coursera Blog", sector: "Education", category: "course_announcement", collectorSource: "coursera_rss", limit: 6 },
    { url: "https://blog.coursera.org/career-development/feed/", type: "formation", source: "Coursera Blog", sector: "Career Development", category: "career_guide", collectorSource: "coursera_rss", limit: 6 },
    { url: "https://blog.udemy.com/feed/", type: "formation", source: "Udemy Blog", sector: "Online Learning", category: "learning_guide", collectorSource: "udemy_rss", limit: 5 },
    { url: "https://blog.udemy.com/category/workplace/feed/", type: "formation", source: "Udemy Blog", sector: "Career Development", category: "workplace_skills", collectorSource: "udemy_rss", limit: 5 },
    { url: "https://blog.udemy.com/category/developer/feed/", type: "formation", source: "Udemy Blog", sector: "Technology", category: "developer_skills", collectorSource: "udemy_rss", limit: 5 },
    { url: "https://blog.udemy.com/category/data-science/feed/", type: "formation", source: "Udemy Blog", sector: "Data Science", category: "data_skills", collectorSource: "udemy_rss", limit: 5 },
    { url: "https://ocw.mit.edu/rss/new_courses.xml", type: "formation", source: "MIT OpenCourseWare", sector: "Academic", category: "university_course", collectorSource: "mit_ocw_rss", limit: 5 },
    { url: "https://ocw.mit.edu/rss/recently_published.xml", type: "formation", source: "MIT OpenCourseWare", sector: "Academic", category: "university_course", collectorSource: "mit_ocw_rss", limit: 5 },
    { url: "https://www.ilsole24ore.com/rss/economia.xml", type: "news", source: "Il Sole 24 Ore", sector: "Economia Italia", category: "economia", collectorSource: "sole24ore_rss", limit: 6 },
    { url: "https://www.ilsole24ore.com/rss/notizie/lavoro-carriere.xml", type: "opportunity", source: "Il Sole 24 Ore", sector: "Mercato del Lavoro", category: "lavoro_carriere", collectorSource: "sole24ore_rss", limit: 6 },
    { url: "https://www.ilsole24ore.com/rss/tecnologia.xml", type: "sector_trend", source: "Il Sole 24 Ore", sector: "Technology", category: "tech_news", collectorSource: "sole24ore_rss", limit: 6 },
    { url: "https://www.ilsole24ore.com/rss/finanza.xml", type: "news", source: "Il Sole 24 Ore", sector: "Finanza", category: "finanza", collectorSource: "sole24ore_rss", limit: 6 },
    { url: "https://www.ansa.it/sito/notizie/economia/economia_rss.xml", type: "news", source: "ANSA", sector: "Economia Italia", category: "economia", collectorSource: "ansa_rss", limit: 6 },
    { url: "https://www.ansa.it/sito/notizie/tecnologia/tecnologia_rss.xml", type: "news", source: "ANSA", sector: "Technology", category: "tech_news", collectorSource: "ansa_rss", limit: 6 },
    { url: "https://www.ansa.it/canale_saluteebenessere/notizie/saluteebenessere_rss.xml", type: "news", source: "ANSA", sector: "Sanita & Life Sciences", category: "health", collectorSource: "ansa_rss", limit: 6 },
    { url: "https://www.wired.it/feed/", type: "news", source: "Wired Italia", sector: "Technology", category: "tech_news", collectorSource: "wired_it_rss", limit: 6 },
    { url: "https://www.repubblica.it/rss/economia/rss2.0.xml", type: "news", source: "La Repubblica", sector: "Economia Italia", category: "economia", collectorSource: "repubblica_rss", limit: 6 },
    { url: "https://www.repubblica.it/rss/salute/rss2.0.xml", type: "news", source: "La Repubblica", sector: "Sanita & Life Sciences", category: "health", collectorSource: "repubblica_rss", limit: 6 },
    { url: "https://www.repubblica.it/rss/scienze/rss2.0.xml", type: "news", source: "La Repubblica", sector: "Sanita & Life Sciences", category: "science", collectorSource: "repubblica_rss", limit: 6 },
    { url: "https://www.ninjamarketing.it/feed/", type: "news", source: "Ninja Marketing", sector: "Digital Marketing", category: "marketing_trend", collectorSource: "ninja_marketing_rss", limit: 5 },
    { url: "https://www.ninjamarketing.it/category/startup-innovazione/feed/", type: "opportunity", source: "Ninja Marketing", sector: "Startup", category: "startup_italia", collectorSource: "ninja_marketing_rss", limit: 5 },
    { url: "https://www.ninjamarketing.it/category/social-media/feed/", type: "sector_trend", source: "Ninja Marketing", sector: "Social Media", category: "social_media", collectorSource: "ninja_marketing_rss", limit: 5 },
  ];
  const selectedFeeds = priorityOnly
    ? feeds.filter((feed) => (
      feed.type === "news"
      && ["sole24ore_rss", "ninja_marketing_rss", "ansa_rss", "repubblica_rss"].includes(feed.collectorSource)
    ))
    : feeds;
  const results: RawItem[] = [];
  await Promise.allSettled(selectedFeeds.map(async (feed) => {
    try {
      const entries = await fetchRSS(feed.url, feed.limit);
      for (const entry of entries) {
        const isUdemyReport = feed.collectorSource === "udemy_rss" && /trend|report|top \d|in \d{4}|stat|survey/i.test(entry.title);
        const summary = entry.summary || `${feed.source}: ${entry.title}`;
        const sectorNames = feed.type === "news"
          ? classifyItalianLaborSectors({ title: entry.title, summary, fallbackSector: feed.sector })
          : [feed.sector];
        results.push({ type: isUdemyReport ? "sector_trend" : feed.type, title: entry.title, url: entry.url, source: feed.source, summary, imageUrl: entry.imageUrl, publishedAt: entry.publishedAt, category: feed.category, sectorNames, collectorSource: feed.collectorSource, searchQuery: feed.sector });
      }
    } catch (err) {
      logger.warn({ err, feedUrl: feed.url }, `[collector] ${feed.collectorSource} failed`);
    }
  }));
  return results;
}

async function collectYouTubeEDU(): Promise<RawItem[]> {
  const channels: Array<{ id: string; name: string; type: ItemType; sector: string; category: string }> = [
    { id: "UCsooa4yRKGN_zEE8iknghZA", name: "TED-Ed", type: "growth", sector: "Education", category: "educational_video" },
    { id: "UCcefcZRL2oaA_uBNeo5UNqg", name: "Y Combinator", type: "opportunity", sector: "Startup", category: "startup_advice" },
    { id: "UCsBjURrPoezykLs9EqgamOA", name: "Fireship", type: "formation", sector: "Technology", category: "tech_tutorial" },
    { id: "UCoOae5nYA7VqaXzerajD0lg", name: "Ali Abdaal", type: "growth", sector: "Personal Development", category: "productivity" },
    { id: "UCG-KntY7aVnIGXYEBQvmBAQ", name: "Thomas Frank", type: "growth", sector: "Personal Development", category: "study_habits" },
  ];
  const results: RawItem[] = [];
  await Promise.allSettled(channels.map(async ({ id, name, type, sector, category }) => {
    try {
      const entries = await fetchRSS(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`, 3);
      for (const e of entries) {
        const videoId = new URL(e.url).searchParams.get("v");
        const imageUrl = e.imageUrl ?? (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : undefined);
        results.push({ type, title: e.title, url: e.url, source: `YouTube â€” ${name}`, summary: e.summary || `Video di ${name}: ${e.title}`, imageUrl, publishedAt: e.publishedAt, category, sectorNames: [sector], collectorSource: "youtube_edu", searchQuery: name });
      }
    } catch (err) {
      logger.warn({ err, channel: name }, "[collector] YouTube RSS failed");
    }
  }));
  return results;
}

async function collectDynamicSources(priorityOnly = false): Promise<RawItem[]> {
  let sources: Array<{ id: number; name: string; feedUrl: string; itemType: string; sector: string; category: string; itemsPerRun: number; priority?: boolean | null }>;
  try {
    sources = await db
      .select()
      .from(discoverySourcesTable)
      .where(priorityOnly
        ? and(eq(discoverySourcesTable.enabled, true), eq(discoverySourcesTable.priority, true))
        : eq(discoverySourcesTable.enabled, true));
  } catch (err) {
    logger.warn({ err }, "[collector] dynamic sources DB read failed");
    return [];
  }
  const results: RawItem[] = [];
  await Promise.allSettled(sources.map(async (src) => {
    try {
      const entries = await fetchRSS(src.feedUrl, src.itemsPerRun ?? 6);
      for (const e of entries) {
        results.push({ type: (src.itemType as ItemType) ?? "news", title: e.title, url: e.url, source: src.name, summary: e.summary || `${src.name}: ${e.title}`, imageUrl: e.imageUrl, publishedAt: e.publishedAt, category: src.category ?? src.itemType ?? "news", sectorNames: [src.sector ?? "General"], collectorSource: `dynamic_${src.id}`, searchQuery: src.name });
      }
    } catch (err) {
      logger.warn({ err, sourceName: src.name, feedUrl: src.feedUrl }, "[collector] dynamic source failed");
    }
  }));
  return results;
}

export async function collectTrustedItalianNews(): Promise<RawItem[]> {
  const [gnews, tavily, staticRss] = await Promise.all([
    collectGNews(),
    collectTavilyNews(),
    collectStaticRssSources(true),
  ]);
  return [...gnews, ...tavily, ...staticRss].filter((item) => item.type === "news");
}

export interface CollectorSourceOptions {
  priorityOnly?: boolean;
}

export function getCollectorSources(options: CollectorSourceOptions = {}): CollectorSource[] {
  if (options.priorityOnly) {
    return [
      { name: "hackernews", fn: collectHackerNews },
      { name: "newsapi", fn: collectNewsAPI },
      { name: "gnews", fn: collectGNews },
      { name: "tavily_news", fn: collectTavilyNews },
      { name: "static_priority_rss", fn: () => collectStaticRssSources(true) },
      { name: "dynamic_priority_sources", fn: () => collectDynamicSources(true) },
    ];
  }

  return [
    { name: "hackernews", fn: collectHackerNews },
    { name: "devto", fn: collectDevTo },
    { name: "reddit", fn: collectReddit },
    { name: "newsapi", fn: collectNewsAPI },
    { name: "gnews", fn: collectGNews },
    { name: "tavily_news", fn: collectTavilyNews },
    { name: "static_rss", fn: () => collectStaticRssSources(false) },
    { name: "youtube_edu", fn: collectYouTubeEDU },
    { name: "dynamic_sources", fn: () => collectDynamicSources(false) },
    { name: "scraping_sources", fn: collectScrapingSources },
  ];
}
