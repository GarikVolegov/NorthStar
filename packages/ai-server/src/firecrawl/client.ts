/**
 * client.ts — Wrapper minimale per l'API Firecrawl self-hosted (v1).
 *
 * Env:
 *   FIRECRAWL_BASE_URL    — default http://firecrawl-api:3002
 *   FIRECRAWL_API_KEY     — opzionale in self-host puro
 *   FIRECRAWL_TIMEOUT_MS  — default 30000
 *
 * Usa fetch nativo Node >=18. Retry leggero (1 tentativo) su errori di rete;
 * nessun retry su 4xx.
 */
import { logger } from "../logger";
import type {
  ScrapeOptions, ScrapeResult,
  CrawlOptions, CrawlStatus,
  MapOptions,
  SearchOptions, SearchResultItem,
  ExtractOptions, ExtractResult,
} from "./types";

const DEFAULT_TIMEOUT = Number(process.env.FIRECRAWL_TIMEOUT_MS ?? 30_000);

export interface FirecrawlClientConfig {
  baseUrl?:   string;
  apiKey?:    string;
  timeoutMs?: number;
}

export class FirecrawlClient {
  private readonly baseUrl:   string;
  private readonly apiKey:    string | undefined;
  private readonly timeoutMs: number;

  constructor(cfg: FirecrawlClientConfig = {}) {
    this.baseUrl   = (cfg.baseUrl   ?? process.env.FIRECRAWL_BASE_URL ?? "http://firecrawl-api:3002").replace(/\/+$/, "");
    this.apiKey    = cfg.apiKey    ?? process.env.FIRECRAWL_API_KEY ?? undefined;
    this.timeoutMs = cfg.timeoutMs ?? DEFAULT_TIMEOUT;
  }

  isAvailable(): boolean {
    return Boolean(this.baseUrl);
  }

  private async request<T>(
    method: "GET" | "POST",
    path:   string,
    body?:  unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Accept":       "application/json",
    };
    if (this.apiKey) headers["Authorization"] = `Bearer ${this.apiKey}`;

    let lastErr: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers,
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (res.status >= 400 && res.status < 500) {
            clearTimeout(timer);
            throw new FirecrawlError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status);
          }
          lastErr = new FirecrawlError(`HTTP ${res.status}: ${text.slice(0, 200)}`, res.status);
          clearTimeout(timer);
          continue;
        }

        clearTimeout(timer);
        return (await res.json()) as T;
      } catch (e) {
        clearTimeout(timer);
        if ((e as Error).name === "AbortError") {
          throw new FirecrawlError(`Timeout ${this.timeoutMs}ms`, 0);
        }
        if (e instanceof FirecrawlError && e.status >= 400 && e.status < 500) {
          throw e;
        }
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new FirecrawlError(String(lastErr), 0);
  }

  async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    const payload = {
      url,
      formats:         options.formats ?? ["markdown"],
      onlyMainContent: options.onlyMainContent ?? true,
      ...(options.includeTags ? { includeTags: options.includeTags } : {}),
      ...(options.excludeTags ? { excludeTags: options.excludeTags } : {}),
      ...(options.waitFor !== undefined ? { waitFor: options.waitFor } : {}),
      ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
      ...(options.headers ? { headers: options.headers } : {}),
      ...(options.extract ? { extract: options.extract } : {}),
    };
    const res = await this.request<{ success: boolean; data: ScrapeResult; error?: string }>(
      "POST", "/v1/scrape", payload,
    );
    if (!res.success) throw new FirecrawlError(res.error ?? "scrape failed", 0);
    return res.data;
  }

  async startCrawl(url: string, options: CrawlOptions = {}): Promise<{ id: string; url: string }> {
    const payload = {
      url,
      ...(options.limit             !== undefined ? { limit: options.limit }                 : {}),
      ...(options.maxDepth          !== undefined ? { maxDepth: options.maxDepth }           : {}),
      ...(options.includePaths      ? { includePaths: options.includePaths }                 : {}),
      ...(options.excludePaths      ? { excludePaths: options.excludePaths }                 : {}),
      ...(options.allowBackwardLinks !== undefined ? { allowBackwardLinks: options.allowBackwardLinks } : {}),
      ...(options.allowExternalLinks !== undefined ? { allowExternalLinks: options.allowExternalLinks } : {}),
      ...(options.scrapeOptions     ? { scrapeOptions: options.scrapeOptions }               : {}),
    };
    const res = await this.request<{ success: boolean; id: string; url: string; error?: string }>(
      "POST", "/v1/crawl", payload,
    );
    if (!res.success) throw new FirecrawlError(res.error ?? "crawl start failed", 0);
    return { id: res.id, url: res.url };
  }

  async getCrawlStatus(id: string): Promise<CrawlStatus> {
    return this.request<CrawlStatus>("GET", `/v1/crawl/${encodeURIComponent(id)}`);
  }

  async crawlAndWait(
    url: string,
    options: CrawlOptions = {},
    pollOptions: { intervalMs?: number; maxWaitMs?: number } = {},
  ): Promise<CrawlStatus> {
    const intervalMs = pollOptions.intervalMs ?? 3_000;
    const maxWaitMs  = pollOptions.maxWaitMs  ?? 300_000;
    const { id }    = await this.startCrawl(url, options);
    const t0 = Date.now();

    while (Date.now() - t0 < maxWaitMs) {
      const status = await this.getCrawlStatus(id);
      if (status.status === "completed" || status.status === "failed") {
        return status;
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new FirecrawlError(`crawl ${id} timeout dopo ${maxWaitMs}ms`, 0);
  }

  async map(url: string, options: MapOptions = {}): Promise<string[]> {
    const payload = {
      url,
      ...(options.search ? { search: options.search } : {}),
      ...(options.limit  !== undefined ? { limit: options.limit } : {}),
      ...(options.includeSubdomains !== undefined ? { includeSubdomains: options.includeSubdomains } : {}),
    };
    const res = await this.request<{ success: boolean; links: string[]; error?: string }>(
      "POST", "/v1/map", payload,
    );
    if (!res.success) throw new FirecrawlError(res.error ?? "map failed", 0);
    return res.links ?? [];
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResultItem[]> {
    const payload = {
      query,
      ...(options.limit !== undefined ? { limit: options.limit } : {}),
      ...(options.country ? { country: options.country } : {}),
      ...(options.lang    ? { lang:    options.lang    } : {}),
      ...(options.scrapeOptions ? { scrapeOptions: options.scrapeOptions } : {}),
    };
    const res = await this.request<{ success: boolean; data: SearchResultItem[]; error?: string }>(
      "POST", "/v1/search", payload,
    );
    if (!res.success) throw new FirecrawlError(res.error ?? "search failed", 0);
    return res.data ?? [];
  }

  async extract(options: ExtractOptions): Promise<ExtractResult> {
    if (!options.urls?.length) throw new FirecrawlError("extract richiede almeno un URL", 400);
    const payload = {
      urls:             options.urls,
      ...(options.schema       ? { schema: options.schema }             : {}),
      ...(options.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      ...(options.prompt       ? { prompt: options.prompt }             : {}),
      ...(options.enableWebSearch !== undefined ? { enableWebSearch: options.enableWebSearch } : {}),
    };
    return this.request<ExtractResult>("POST", "/v1/extract", payload);
  }
}

export class FirecrawlError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "FirecrawlError";
  }
}

let _client: FirecrawlClient | null = null;

export function getFirecrawlClient(cfg?: FirecrawlClientConfig): FirecrawlClient {
  if (!_client) {
    _client = new FirecrawlClient(cfg);
    logger.info(
      { baseUrl: process.env.FIRECRAWL_BASE_URL ?? "(default)" },
      "[firecrawl] client initialized",
    );
  }
  return _client;
}

export function resetFirecrawlClient(): void {
  _client = null;
}
