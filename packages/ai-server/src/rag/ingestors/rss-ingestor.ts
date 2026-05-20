/**
 * rss-ingestor.ts — ingesta feed RSS/Atom nel knowledge base RAG.
 *
 * Flusso:
 *   1. Fetch del feed XML
 *   2. Parsing degli item (titolo + descrizione + link + pubDate)
 *   3. Filtra articoli più recenti di `maxAgeDays`
 *   4. Un chunk per articolo → embedding → rag_chunks
 *
 * Non salva articoli completi (redirect a URL) — solo titolo + summary
 * per rispettare i TOS dei feed e mantenere chunk compatti.
 */
import { chunkNews }   from "../chunker";
import { indexChunks } from "../indexer";
import { logger }      from "../../logger";

export interface RssIngestOptions {
  sourceId:    number;
  feedUrl:     string;
  geography?:  string[];
  sectors?:    string[];
  maxAgeDays?: number;   // default 30
  maxItems?:   number;   // default 20
}

export interface RssIngestResult {
  chunksIndexed: number;
  itemsFound:    number;
  durationMs:    number;
}

interface RssItem {
  title:       string;
  description: string;
  pubDate:     Date | null;
  link:        string;
}

function parseXmlItems(xml: string): RssItem[] {
  const items: RssItem[] = [];

  // Semplice regex parser — non usa librerie per ridurre deps
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/gi);
  for (const match of itemMatches) {
    const block = match[1];
    if (!block) continue;
    const title = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? "";
    const desc  = block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]?.trim() ?? "";
    const link  = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim() ?? "";
    const dateStr = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? "";

    const cleanDesc = desc
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();

    items.push({
      title,
      description: cleanDesc,
      pubDate:     dateStr ? new Date(dateStr) : null,
      link,
    });
  }

  return items;
}

export async function ingestRssToRag(opts: RssIngestOptions): Promise<RssIngestResult> {
  const t0          = Date.now();
  const maxAgeDays  = opts.maxAgeDays ?? 30;
  const maxItems    = Math.min(opts.maxItems ?? 20, 50);
  const cutoff      = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  logger.info({ feedUrl: opts.feedUrl, sourceId: opts.sourceId }, "[rss-ingestor] fetching feed");

  let xml: string;
  try {
    const res = await fetch(opts.feedUrl, {
      headers: { "User-Agent": "NorthStar-RAG/1.0 (+https://northstar.app)" },
      signal:  AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    xml = await res.text();
  } catch (e) {
    throw new Error(`[rss-ingestor] fetch fallito (${opts.feedUrl}): ${String(e)}`);
  }

  const items = parseXmlItems(xml)
    .filter((item) => !item.pubDate || item.pubDate >= cutoff)
    .slice(0, maxItems);

  if (items.length === 0) {
    logger.info({ sourceId: opts.sourceId }, "[rss-ingestor] nessun articolo recente trovato");
    return { chunksIndexed: 0, itemsFound: 0, durationMs: Date.now() - t0 };
  }

  // Un testo per articolo: "Titolo\n\nDescrizione"
  const texts: string[] = [];
  const publishedDates: (Date | null)[] = [];

  for (const item of items) {
    const text = [item.title, item.description].filter(Boolean).join("\n\n");
    const chunks = chunkNews(text);
    for (const chunk of chunks) {
      texts.push(chunk.content);
      publishedDates.push(item.pubDate);
    }
  }

  // Usa la data del primo articolo come publishedAt della fonte
  const mostRecent = items[0]?.pubDate ?? new Date();

  const indexed = await indexChunks(texts, {
    sourceId:    opts.sourceId,
    docType:     "news",
    geography:   opts.geography,
    sectors:     opts.sectors,
    publishedAt: mostRecent,
  });

  return { chunksIndexed: indexed.chunksIndexed, itemsFound: items.length, durationMs: Date.now() - t0 };
}
