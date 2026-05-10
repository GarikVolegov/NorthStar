const TAVILY_BASE = "https://api.tavily.com";
const DEFAULT_TIMEOUT_MS = 20_000;

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
}

export interface TavilyResponse {
  answer?: string;
  query: string;
  results: TavilyResult[];
  response_time?: number;
}

export interface TavilySearchOptions {
  query: string;
  searchDepth?: "basic" | "advanced";
  topic?: "general" | "news";
  days?: number;
  maxResults?: number;
  includeAnswer?: boolean;
  includeDomains?: string[];
  excludeDomains?: string[];
}

function getKey(): string {
  const k = process.env.TAVILY_API_KEY;
  if (!k) throw new Error("TAVILY_API_KEY not set");
  return k;
}

export async function tavilySearch(opts: TavilySearchOptions): Promise<TavilyResponse> {
  const body = {
    query: opts.query,
    search_depth: opts.searchDepth ?? "basic",
    topic: opts.topic ?? "general",
    days: opts.days,
    max_results: opts.maxResults ?? 5,
    include_answer: opts.includeAnswer ?? true,
    include_raw_content: false,
    include_domains: opts.includeDomains,
    exclude_domains: opts.excludeDomains,
  };

  const res = await fetch(`${TAVILY_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily search failed [${res.status}]: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<TavilyResponse>;
}

export function urlHash(url: string): string {
  let h = 0;
  for (let i = 0; i < url.length; i++) {
    const c = url.charCodeAt(i);
    h = ((h << 5) - h + c) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    const params = new URLSearchParams(
      [...u.searchParams.entries()].filter(
        ([k]) => !["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"].includes(k),
      ),
    );
    u.search = params.toString();
    return u.toString();
  } catch {
    return url;
  }
}
