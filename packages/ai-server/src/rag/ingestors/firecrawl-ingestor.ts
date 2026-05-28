/**
 * firecrawl-ingestor.ts — ingesta contenuti scrappati con Firecrawl nel RAG.
 *
 * Due modalità:
 *   - ingestFirecrawlUrl:   scrape singolo URL → 1+ chunk
 *   - ingestFirecrawlCrawl: crawl bloccante di un sito → N pagine → N*M chunk
 *
 * Le pagine sono già markdown pulito (Firecrawl onlyMainContent),
 * quindi riusiamo chunkDocument(docType="generic" o "report").
 */
import { chunkDocument } from "../chunker";
import { indexChunks }   from "../indexer";
import { getFirecrawlClient } from "../../firecrawl";
import type { CrawlOptions, ScrapeResult } from "../../firecrawl";
import { logger } from "../../logger";

export interface FirecrawlIngestOptions {
  sourceId:    number;
  /** Tipo logico del documento per scelta strategia chunking */
  docType?:    "report" | "news" | "generic";
  geography?:  string[];
  sectors?:    string[];
  roles?:      string[];
  /** Pagine massime da ingerire (per crawl) */
  maxPages?:   number;
}

export interface FirecrawlIngestResult {
  chunksIndexed: number;
  pagesScraped:  number;
  durationMs:    number;
  failedUrls:    string[];
}

function buildChunkTexts(
  pages: ScrapeResult[],
  docType: "report" | "news" | "generic",
): string[] {
  const out: string[] = [];
  for (const p of pages) {
    const md = (p.markdown ?? "").trim();
    if (md.length < 80) continue;
    const header = p.metadata?.title
      ? `# ${p.metadata.title}\n\n${p.url}\n\n`
      : `${p.url}\n\n`;
    const chunks = chunkDocument(header + md, docType);
    for (const c of chunks) out.push(c.content);
  }
  return out;
}

// ── Singolo URL ──────────────────────────────────────────────────────────────

export async function ingestFirecrawlUrl(
  url: string,
  opts: FirecrawlIngestOptions,
): Promise<FirecrawlIngestResult> {
  const t0 = Date.now();
  const client = getFirecrawlClient();
  const docType = opts.docType ?? "generic";
  const failedUrls: string[] = [];

  let page: ScrapeResult | null = null;
  try {
    page = await client.scrape(url, { formats: ["markdown"], onlyMainContent: true });
  } catch (e) {
    logger.warn({ e, url }, "[firecrawl-ingestor] scrape failed");
    failedUrls.push(url);
  }

  if (!page) {
    return { chunksIndexed: 0, pagesScraped: 0, durationMs: Date.now() - t0, failedUrls };
  }

  const texts = buildChunkTexts([page], docType);
  if (texts.length === 0) {
    return { chunksIndexed: 0, pagesScraped: 1, durationMs: Date.now() - t0, failedUrls };
  }

  const indexResult = await indexChunks(texts, {
    sourceId:   opts.sourceId,
    docType:    docType === "generic" ? "generic" : docType,
    geography:  opts.geography,
    sectors:    opts.sectors,
    roles:      opts.roles,
    publishedAt: new Date(),
  });

  return {
    chunksIndexed: indexResult.chunksIndexed,
    pagesScraped:  1,
    durationMs:    Date.now() - t0,
    failedUrls,
  };
}

// ── Crawl intero sito ────────────────────────────────────────────────────────

export async function ingestFirecrawlCrawl(
  url: string,
  crawlOptions: CrawlOptions,
  opts: FirecrawlIngestOptions,
): Promise<FirecrawlIngestResult> {
  const t0 = Date.now();
  const client = getFirecrawlClient();
  const docType = opts.docType ?? "generic";
  const maxPages = Math.min(opts.maxPages ?? 50, 200);

  const status = await client.crawlAndWait(url, {
    limit: maxPages,
    ...crawlOptions,
    scrapeOptions: {
      formats: ["markdown"],
      onlyMainContent: true,
      ...(crawlOptions.scrapeOptions ?? {}),
    },
  });

  if (status.status === "failed") {
    logger.warn({ url, error: status.error }, "[firecrawl-ingestor] crawl failed");
    return { chunksIndexed: 0, pagesScraped: 0, durationMs: Date.now() - t0, failedUrls: [url] };
  }

  const pages = status.data ?? [];
  const texts = buildChunkTexts(pages, docType);

  if (texts.length === 0) {
    return { chunksIndexed: 0, pagesScraped: pages.length, durationMs: Date.now() - t0, failedUrls: [] };
  }

  const indexResult = await indexChunks(texts, {
    sourceId:    opts.sourceId,
    docType:     docType === "generic" ? "generic" : docType,
    geography:   opts.geography,
    sectors:     opts.sectors,
    roles:       opts.roles,
    publishedAt: new Date(),
  });

  return {
    chunksIndexed: indexResult.chunksIndexed,
    pagesScraped:  pages.length,
    durationMs:    Date.now() - t0,
    failedUrls:    [],
  };
}
