/**
 * Web search fallback using Tavily API.
 *
 * Called when the retriever returns < MIN_LOCAL_CHUNKS relevant results,
 * meaning the question goes beyond the ingested knowledge base.
 *
 * Results are returned as RetrievedChunk-compatible objects so the
 * prompt builder handles them uniformly.
 */
import type { RetrievedChunk } from "./retriever";

const TAVILY_URL = "https://api.tavily.com/search";
const MIN_LOCAL_CHUNKS = 3;

export { MIN_LOCAL_CHUNKS };

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function searchWeb(
  query: string,
  maxResults = 4,
): Promise<RetrievedChunk[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("[growth-agent] TAVILY_API_KEY not set — skipping web search");
    return [];
  }

  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "advanced",
      max_results: maxResults,
      include_raw_content: false,
    }),
  });

  if (!res.ok) {
    console.error("[growth-agent] Tavily error", res.status);
    return [];
  }

  const data = (await res.json()) as { results: WebSearchResult[] };

  return (data.results ?? []).map((r) => ({
    id: -1,
    content: r.content,
    source: r.url,
    sourceType: "web" as const,
    score: r.score,
    metadata: { title: r.title, url: r.url },
  }));
}
