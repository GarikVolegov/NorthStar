export interface NewsItem {
  id: string;
  title: string;
  preview?: string;
  description: string;
  source: string;
  sourceUrl?: string;
  url: string;
  detailUrl?: string;
  publishedAt: string;
  image: string | null;
  language?: "it" | "en" | "es" | "fr" | "de";
  meaning?: {
    label?: string;
    audience?: string;
    happened?: string;
    whyItMatters: string;
    practicalNextStep?: string;
    action?: string;
    signal: string;
    sections?: Array<{
      key: "audience" | "happened" | "why" | "practical";
      body: string;
    }>;
  };
  category: string;
  sector: string | null;
  tags: string[];
  relevance: number;
  plan: "free" | "premium";
}

export interface ProfileData {
  exploredSectors: Array<{
    sectorId: number;
    name: string;
    icon: string;
    confirmed: boolean;
  }>;
}

export interface NewsSubscriptionsResponse {
  subscriptions?: string[];
}

export interface NewsFeedResponse {
  news: NewsItem[];
  nextCursor?: string | null;
  source: "live" | "partial" | "static" | "auto_refresh" | "error";
  status?: "ok" | "empty" | "partial" | "error";
  error?: string;
  errors?: string[];
  refresh?: {
    attempted?: boolean;
    reason?: "empty" | "stale";
    transferred?: number;
    missingCoverage?: number;
    durationMs?: number;
    error?: string;
  };
  diagnostics?: {
    providerStatus: "ready" | "degraded" | "never_run" | "stale" | "not_configured" | "unavailable";
    lastAttemptAt: string | null;
    enabledSources: number;
    sourcesWithErrors: number;
    refreshAction:
      | "wait_for_next_refresh"
      | "wait_for_startup_pipeline"
      | "check_provider_keys"
      | "configure_sources"
      | "retry_later";
    message: string;
    lastRefreshError?: string;
  };
}

export const CATEGORY_CONFIG = [
  { id: "general", emoji: "🌍", gradient: "from-blue-500/20 to-blue-600/10" },
  { id: "technology", emoji: "💻", gradient: "from-cyan-500/20 to-blue-600/10" },
  { id: "business", emoji: "📈", gradient: "from-emerald-500/20 to-green-600/10" },
  { id: "science", emoji: "🔬", gradient: "from-purple-500/20 to-violet-600/10" },
  { id: "health", emoji: "❤️", gradient: "from-rose-500/20 to-red-600/10" },
  { id: "finance", emoji: "💰", gradient: "from-amber-500/20 to-yellow-600/10" },
  { id: "education", emoji: "🎓", gradient: "from-indigo-500/20 to-blue-600/10" },
] as const;

export const NEWS_STALE_MS = 15 * 60_000;

export function diagnosticTone(status: NonNullable<NewsFeedResponse["diagnostics"]>["providerStatus"]) {
  if (status === "ready") return "border-success-muted bg-success-surface text-success";
  if (status === "degraded" || status === "stale") return "border-warning-muted bg-warning-surface text-warning";
  return "border-destructive/25 bg-destructive/10 text-destructive";
}

export function readDiagnosticsFromError(error: unknown): NewsFeedResponse["diagnostics"] | undefined {
  if (!error || typeof error !== "object") return undefined;
  const body = (error as { body?: unknown }).body;
  if (!body || typeof body !== "object") return undefined;
  const diagnostics = (body as { diagnostics?: unknown }).diagnostics;
  if (!diagnostics || typeof diagnostics !== "object") return undefined;
  if (typeof (diagnostics as { message?: unknown }).message !== "string") return undefined;
  return diagnostics as NewsFeedResponse["diagnostics"];
}

export function timeAgoLabel(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return t("news.timeAgo.lessThan1h");
  if (h === 1) return t("news.timeAgo.1h");
  if (h < 24) return t("news.timeAgo.hours", { h });
  const d = Math.floor(h / 24);
  return d === 1 ? t("news.timeAgo.yesterday") : t("news.timeAgo.days", { d });
}
