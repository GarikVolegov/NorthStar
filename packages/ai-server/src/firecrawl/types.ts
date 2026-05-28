/**
 * Tipi normalizzati per il client Firecrawl self-hosted.
 * Coprono v1 API (/scrape, /crawl, /map, /search, /extract).
 */

export type FirecrawlFormat =
  | "markdown"
  | "html"
  | "rawHtml"
  | "links"
  | "screenshot"
  | "extract";

export interface ScrapeOptions {
  formats?:           FirecrawlFormat[];
  onlyMainContent?:   boolean;
  includeTags?:       string[];
  excludeTags?:       string[];
  waitFor?:           number;
  timeout?:           number;
  headers?:           Record<string, string>;
  extract?: {
    schema?:           Record<string, unknown>;
    systemPrompt?:     string;
    prompt?:           string;
  };
}

export interface ScrapeResult {
  url:        string;
  markdown?:  string;
  html?:      string;
  rawHtml?:   string;
  links?:     string[];
  metadata?:  {
    title?:        string;
    description?:  string;
    language?:     string;
    sourceURL?:    string;
    statusCode?:   number;
    error?:        string;
    [k: string]:   unknown;
  };
  extract?:   Record<string, unknown>;
  screenshot?: string;
}

export interface CrawlOptions {
  limit?:             number;
  maxDepth?:          number;
  includePaths?:      string[];
  excludePaths?:      string[];
  allowBackwardLinks?: boolean;
  allowExternalLinks?: boolean;
  scrapeOptions?:     ScrapeOptions;
}

export interface CrawlStatus {
  status:    "scraping" | "completed" | "failed";
  total:     number;
  completed: number;
  data:      ScrapeResult[];
  next?:     string;
  error?:    string;
}

export interface MapOptions {
  search?:           string;
  limit?:            number;
  includeSubdomains?: boolean;
}

export interface SearchOptions {
  limit?:        number;
  country?:      string;
  lang?:         string;
  scrapeOptions?: ScrapeOptions;
}

export interface SearchResultItem {
  url:        string;
  title?:     string;
  description?: string;
  markdown?:  string;
}

export interface ExtractOptions {
  urls:           string[];
  schema?:        Record<string, unknown>;
  systemPrompt?:  string;
  prompt?:        string;
  enableWebSearch?: boolean;
}

export interface ExtractResult {
  success: boolean;
  data:    Record<string, unknown> | Record<string, unknown>[];
  status?: string;
  error?:  string;
}
