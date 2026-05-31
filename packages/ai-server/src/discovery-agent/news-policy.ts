export const PUBLIC_NEWS_SOURCES = [
  "gnews",
  "tavily",
  "newsapi",
  "il sole 24 ore",
  "ninja marketing",
  "ansa",
  "wired italia",
  "la repubblica",
] as const;

const APPROVED_COLLECTOR_SOURCES = [
  "gnews",
  "tavily_news",
  "newsapi",
  "sole24ore_rss",
  "ninja_marketing_rss",
  "ansa_rss",
  "wired_it_rss",
  "repubblica_rss",
] as const;

const TRUSTED_AUTO_PUBLISH_COLLECTORS = [
  "gnews",
  "tavily_news",
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
  summary?: string | null | undefined;
}

export function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function formatPublicNewsSource(input: { source: string | null | undefined; collectorSource?: string | null | undefined }): string {
  const source = String(input.source ?? "").replace(/\s+/g, " ").trim();
  const collectorSource = normalize(input.collectorSource);
  const collectorLabels: Record<string, string> = {
    gnews: "GNews",
    tavily_news: "Tavily",
  };
  const label = collectorLabels[collectorSource];
  if (!label) return source || String(input.collectorSource ?? "News").trim() || "News";

  const normalizedSource = normalize(source);
  const normalizedLabel = normalize(label);
  if (!source || normalizedSource === normalizedLabel) return label;
  if (
    normalizedSource.startsWith(`${normalizedLabel}:`)
    || normalizedSource.startsWith(`${normalizedLabel} -`)
    || normalizedSource.startsWith(`${normalizedLabel} `)
  ) {
    return source;
  }
  return `${label}: ${source}`;
}

export function isPublicNewsArticleSource(input: NewsSourceLike): boolean {
  const source = normalize(input.source);
  const url = normalize(input.url);
  if (!source || !url) return false;
  if (url.includes("northstar.internal/seed/")) return false;
  if (BLOCKED_PUBLIC_NEWS_SOURCES.some((blocked) => source.includes(blocked) || url.includes(blocked))) {
    return false;
  }
  return PUBLIC_NEWS_SOURCES.some((approved) => (
    source === approved
    || source.startsWith(`${approved} `)
    || source.startsWith(`${approved}:`)
    || source.startsWith(`${approved} -`)
  ));
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

export function shouldAutoPublishTrustedNews(input: DiscoveryNewsLike): boolean {
  if (normalize(input.type) !== "news") return false;
  const url = normalize(input.url);
  const summary = normalize(input.summary);
  const collectorSource = normalize(input.collectorSource);
  if (!url || url.includes("northstar.internal/seed/")) return false;
  if (summary.length < 24) return false;
  if (BLOCKED_PUBLIC_NEWS_SOURCES.some((blocked) => collectorSource.includes(blocked) || url.includes(blocked))) {
    return false;
  }
  return TRUSTED_AUTO_PUBLISH_COLLECTORS.some((trusted) => collectorSource === trusted);
}
