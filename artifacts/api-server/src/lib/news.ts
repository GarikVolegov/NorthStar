export interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  image: string | null;
  category: string;
  sector: string | null;
  tags: string[];
  relevance: number;
  plan: "free" | "premium";
}

const FREE_CATEGORIES = [
  "general",
  "business",
  "technology",
  "science",
  "health",
  "finance",
  "education",
] as const;

type FreeCategory = (typeof FREE_CATEGORIES)[number];

const SECTOR_KEYWORDS: Record<string, string> = {
  ai: "intelligenza artificiale AI machine learning",
  "data-science": "data science big data analisi dati",
  cybersecurity: "cybersecurity sicurezza informatica hacker",
  fintech: "fintech pagamenti digitali criptovalute blockchain",
  "green-energy": "energia rinnovabile sostenibilità green economia circolare",
  healthcare: "sanità digitale telemedicina healthtech",
  "e-commerce": "e-commerce commercio elettronico marketplace",
  marketing: "marketing digitale social media content creator",
  robotica: "robotica automazione industria 4.0",
  turismo: "turismo viaggi hospitality innovazione",
  educazione: "educazione formazione e-learning università",
  finanza: "finanza investimenti mercati borsa risparmio",
};

const GNEWS_CATEGORY_MAP: Record<FreeCategory, string> = {
  general: "general",
  business: "business",
  technology: "technology",
  science: "science",
  health: "health",
  finance: "business",
  education: "general",
};

const STATIC_NEWS: NewsItem[] = [
  {
    id: "static-1",
    title: "Il mercato del lavoro italiano cresce nel digitale: +18% di assunzioni tech",
    description:
      "Le aziende italiane accelerano la ricerca di profili digitali. Sviluppatori, data analyst e cybersecurity specialist tra i ruoli più richiesti nel 2025.",
    source: "Il Sole 24 Ore",
    url: "https://www.ilsole24ore.com",
    publishedAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    image: null,
    category: "technology",
    sector: null,
    tags: ["lavoro", "tech", "digitale"],
    relevance: 95,
    plan: "free",
  },
  {
    id: "static-2",
    title: "Green economy: l'Italia punta su 200mila nuovi posti di lavoro verdi entro il 2027",
    description:
      "Il Piano Nazionale per la Transizione Ecologica prevede investimenti massicci che genereranno occupazione nei settori rinnovabili, efficienza energetica e mobilità sostenibile.",
    source: "La Repubblica",
    url: "https://www.repubblica.it",
    publishedAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    image: null,
    category: "science",
    sector: null,
    tags: ["green", "sostenibilità", "occupazione"],
    relevance: 90,
    plan: "free",
  },
  {
    id: "static-3",
    title: "Startup italiane: raccolta fondi record a 1,2 miliardi nel primo semestre",
    description:
      "Ecosistema startup in forte crescita. Fintech, healthtech e deep tech trainano gli investimenti. Milano si conferma hub principale.",
    source: "StartupItalia",
    url: "https://startupitalia.eu",
    publishedAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    image: null,
    category: "business",
    sector: null,
    tags: ["startup", "investimenti", "innovazione"],
    relevance: 88,
    plan: "free",
  },
  {
    id: "static-4",
    title: "Università italiane: il 70% degli studenti teme di scegliere la facoltà sbagliata",
    description:
      "Una ricerca dell'Istituto Cattaneo rivela come la mancanza di orientamento professionale influenzi negativamente le scelte formative. L'orientamento precoce diventa priorità.",
    source: "Corriere della Sera",
    url: "https://www.corriere.it",
    publishedAt: new Date(Date.now() - 12 * 3600000).toISOString(),
    image: null,
    category: "education",
    sector: null,
    tags: ["università", "orientamento", "formazione"],
    relevance: 97,
    plan: "free",
  },
  {
    id: "static-5",
    title: "Salute mentale e lavoro: burnout in aumento tra i giovani professionisti",
    description:
      "Il 38% dei lavoratori under 35 dichiara di soffrire di stress cronico. Le aziende rispondono con nuove politiche di welfare e flessibilità.",
    source: "Vanity Fair",
    url: "https://www.vanityfair.it",
    publishedAt: new Date(Date.now() - 18 * 3600000).toISOString(),
    image: null,
    category: "health",
    sector: null,
    tags: ["benessere", "lavoro", "burnout"],
    relevance: 85,
    plan: "free",
  },
  {
    id: "static-6",
    title: "Intelligenza artificiale generativa: come cambierà 65% dei lavori entro il 2030",
    description:
      "Il World Economic Forum aggiorna le stime: l'AI non sostituirà i lavori ma li trasformerà. Le competenze più richieste: pensiero critico, creatività e capacità di lavorare con l'AI.",
    source: "Wired Italia",
    url: "https://www.wired.it",
    publishedAt: new Date(Date.now() - 24 * 3600000).toISOString(),
    image: null,
    category: "technology",
    sector: null,
    tags: ["AI", "futuro", "competenze"],
    relevance: 93,
    plan: "free",
  },
  {
    id: "static-7",
    title: "PNRR e formazione: 4 miliardi per aggiornare le competenze degli italiani",
    description:
      "I fondi europei finanziano corsi di upskilling e reskilling. Priorità a digitale, sostenibilità e soft skill. Come accedere ai bandi.",
    source: "Il Messaggero",
    url: "https://www.ilmessaggero.it",
    publishedAt: new Date(Date.now() - 30 * 3600000).toISOString(),
    image: null,
    category: "finance",
    sector: null,
    tags: ["PNRR", "formazione", "competenze"],
    relevance: 82,
    plan: "free",
  },
];

interface CacheEntry {
  data: NewsItem[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function getCached(key: string): NewsItem[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NewsItem[]): void {
  cache.set(key, { data, fetchedAt: Date.now() });
}

function generateId(url: string): string {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash << 5) - hash + url.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGNews(article: any, category: string, plan: "free" | "premium"): NewsItem {
  return {
    id: generateId(article.url || article.title),
    title: article.title || "",
    description: article.description || "",
    source: article.source?.name || "Fonte sconosciuta",
    url: article.url || "",
    publishedAt: article.publishedAt || new Date().toISOString(),
    image: article.image || null,
    category,
    sector: null,
    tags: [],
    relevance: 80 + Math.floor(Math.random() * 15),
    plan,
  };
}

async function fetchFromGNews(params: URLSearchParams): Promise<NewsItem[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];

  params.set("apikey", apiKey);
  params.set("lang", "it");
  params.set("country", "it");

  const baseUrl = "https://gnews.io/api/v4";
  const endpoint = params.has("q") ? "search" : "top-headlines";
  const url = `${baseUrl}/${endpoint}?${params.toString()}`;

  try {
    const fetchRes: globalThis.Response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!fetchRes.ok) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = await fetchRes.json() as { articles?: any[] };
    return (data.articles || []) as NewsItem[];
  } catch {
    return [];
  }
}

export async function getFreeNews(
  category: FreeCategory = "general",
  limit = 6
): Promise<NewsItem[]> {
  const cacheKey = `free:${category}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const params = new URLSearchParams({
    category: GNEWS_CATEGORY_MAP[category],
    max: String(limit),
  });

  const rawArticles = await fetchFromGNews(params);
  let result: NewsItem[];

  if (rawArticles.length > 0) {
    result = rawArticles
      .map((a) => normalizeGNews(a, category, "free"))
      .slice(0, limit);
  } else {
    result = STATIC_NEWS.filter((n) => n.category === category || category === "general")
      .slice(0, limit);
    if (result.length === 0) result = STATIC_NEWS.slice(0, limit);
  }

  setCache(cacheKey, result);
  return result;
}

export async function getSectorNews(sector: string, limit = 8): Promise<NewsItem[]> {
  const cacheKey = `sector:${sector}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const q = SECTOR_KEYWORDS[sector] || sector;
  const params = new URLSearchParams({ q, max: String(limit) });

  const rawArticles = await fetchFromGNews(params);
  let result: NewsItem[];

  if (rawArticles.length > 0) {
    result = rawArticles
      .map((a) => ({ ...normalizeGNews(a, "technology", "premium"), sector }))
      .slice(0, limit);
  } else {
    result = STATIC_NEWS.slice(0, limit).map((n) => ({
      ...n,
      sector,
      plan: "premium" as const,
    }));
  }

  result = rankNewsByRelevance(result);
  setCache(cacheKey, result);
  return result;
}

export async function getMultiCategoryNews(
  categories: FreeCategory[] = ["general", "technology", "business", "science"],
  perCategory = 2
): Promise<NewsItem[]> {
  const cacheKey = `multi:${categories.join(",")}:${perCategory}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const results = await Promise.all(categories.map((c) => getFreeNews(c, perCategory)));
  const merged = results.flat();
  const unique = deduplicateNews(merged);
  const ranked = rankNewsByRelevance(unique);

  setCache(cacheKey, ranked);
  return ranked;
}

export function rankNewsByRelevance(news: NewsItem[]): NewsItem[] {
  return [...news].sort((a, b) => {
    const ageDiffHours =
      (new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()) / 3600000;
    const recencyScore = Math.max(0, 10 - Math.abs(ageDiffHours) / 24);
    const scoreDiff = b.relevance + recencyScore - (a.relevance + recencyScore);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });
}

function deduplicateNews(news: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return news.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

export { FREE_CATEGORIES, type FreeCategory };
