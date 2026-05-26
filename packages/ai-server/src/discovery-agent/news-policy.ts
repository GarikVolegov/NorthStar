export const PUBLIC_NEWS_SOURCES = [
  "gnews",
  "newsapi",
  "il sole 24 ore",
  "ninja marketing",
  "ansa",
  "wired italia",
  "la repubblica",
] as const;

const APPROVED_COLLECTOR_SOURCES = [
  "gnews",
  "newsapi",
  "sole24ore_rss",
  "ninja_marketing_rss",
  "ansa_rss",
  "wired_it_rss",
  "repubblica_rss",
] as const;

const BLOCKED_PUBLIC_NEWS_SOURCES = [
  "reddit",
  "dev.to",
  "northstar",
] as const;

export interface NewsSourceLike {
  source: string | null | undefined;
  url: string | null | undefined;
}

export interface DiscoveryNewsLike extends NewsSourceLike {
  type: string | null | undefined;
  collectorSource?: string | null | undefined;
}

export function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isPublicNewsArticleSource(input: NewsSourceLike): boolean {
  const source = normalize(input.source);
  const url = normalize(input.url);
  if (!source || !url) return false;
  if (url.includes("northstar.internal/seed/")) return false;
  if (BLOCKED_PUBLIC_NEWS_SOURCES.some((blocked) => source.includes(blocked) || url.includes(blocked))) {
    return false;
  }
  return PUBLIC_NEWS_SOURCES.some((approved) => source === approved || source.startsWith(`${approved} `));
}

export function isPublishableDiscoveryNews(input: DiscoveryNewsLike): boolean {
  if (normalize(input.type) !== "news") return false;
  const url = normalize(input.url ?? "");
  if (url.includes("northstar.internal/seed/")) return false;

  if (input.collectorSource) {
    const collectorSource = normalize(input.collectorSource);
    if (APPROVED_COLLECTOR_SOURCES.some((approved) => collectorSource === approved)) {
      return true;
    }
  }

  return isPublicNewsArticleSource(input);
}
