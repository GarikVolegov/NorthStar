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
import { logger } from "../logger";
import { withTimeout } from "../utils";
import pRetry from "p-retry";

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
    logger.warn({ query }, "TAVILY_API_KEY not set — web search skipped; set it in env to enable");
    return [];
  }

  try {
    const data = await pRetry(
      async () => {
        const res = await withTimeout(
          fetch(TAVILY_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              api_key: apiKey,
              query,
              search_depth: "advanced",
              max_results: maxResults,
              include_raw_content: false,
              search_lang: "it",
            }),
          }),
          15000,
          "Tavily",
        );

        if (!res.ok) {
          throw new Error(`Tavily returned ${res.status}`);
        }

        return (await res.json()) as { results: WebSearchResult[] };
      },
      {
        retries: 2,
        onFailedAttempt: (err) => {
          logger.warn({ err, attempt: err.attemptNumber, query }, "Tavily retry");
        },
      },
    );

    return (data.results ?? []).map((r) => ({
      id: -1,
      content: r.content,
      source: r.url,
      sourceType: "web" as const,
      score: r.score,
      metadata: { title: r.title, url: r.url },
    }));
  } catch (err) {
    logger.warn({ err }, "web search failed — gracefully degraded");
    return [];
  }
}
