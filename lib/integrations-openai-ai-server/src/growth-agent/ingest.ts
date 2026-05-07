/**
 * Ingest pipeline — takes raw content (text, PDF-extracted text, URL)
 * and stores it in the knowledge graph as embedded chunks.
 *
 * Flow:
 *   raw text → chunkText() → embedBatch() → knowledgeNodesTable INSERT
 *
 * For PDF support, parse with pdf-parse before calling ingestText.
 * For URLs, scrape with cheerio/node-fetch before calling ingestText.
 */
import { db } from "@workspace/db";
import { knowledgeNodesTable } from "@workspace/db";
import { chunkText, embedBatch } from "./embedder";

export type SourceType = "document" | "persona_example" | "user_note" | "web";

export interface IngestOptions {
  userId: number;
  sourceType: SourceType;
  /** Display name for citations, e.g. file name or URL */
  sourceName: string;
  /** Optional free-form metadata (author, date, tags…) */
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  chunksInserted: number;
  sourceType: SourceType;
  sourceName: string;
}

/**
 * Ingest a plain text string.
 * Call this after extracting text from PDF / URL / user input.
 */
export async function ingestText(
  text: string,
  opts: IngestOptions,
): Promise<IngestResult> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return { chunksInserted: 0, ...opts };

  const embeddings = await embedBatch(chunks);

  const rows = chunks.map((chunk, i) => ({
    userId: opts.userId,
    // nodeType is the sourceType column (renamed for clarity internally)
    nodeType: opts.sourceType,
    content: chunk,
    embedding: embeddings[i],
    metadata: {
      source: opts.sourceName,
      chunkIndex: i,
      totalChunks: chunks.length,
      ...opts.metadata,
    },
    sectorId: null,
  }));

  await db.insert(knowledgeNodesTable).values(rows);

  return {
    chunksInserted: chunks.length,
    sourceType: opts.sourceType,
    sourceName: opts.sourceName,
  };
}

/**
 * Ingest a persona example (a Q&A pair that teaches the agent how to reason).
 *
 * Example:
 *   question: "Come esco da un momento di stagnazione?"
 *   answer:   "Prima osservo cosa mi sta dicendo questa fase..."
 *
 * These are stored with sourceType=persona_example and retrieved with
 * a higher weight in the prompt builder.
 */
export async function ingestPersonaExample(
  opts: IngestOptions & {
    question: string;
    answer: string;
    tags?: string[];
  },
): Promise<IngestResult> {
  const combined = `DOMANDA: ${opts.question}\n\nRISPOSTA: ${opts.answer}`;
  return ingestText(combined, {
    userId: opts.userId,
    sourceType: "persona_example",
    sourceName: opts.sourceName ?? "Esempio di ragionamento",
    metadata: {
      question: opts.question,
      tags: opts.tags ?? [],
      ...opts.metadata,
    },
  });
}

/**
 * Scrape a URL and ingest its text content.
 * Strips HTML tags for clean ingestion.
 */
export async function ingestUrl(
  url: string,
  opts: Omit<IngestOptions, "sourceName"> & { sourceName?: string },
): Promise<IngestResult> {
  const res = await fetch(url, {
    headers: { "User-Agent": "NorthStar-GrowthAgent/1.0" },
  });
  if (!res.ok) throw new Error(`[ingest] Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  // Minimal HTML stripping — for production use cheerio or readability
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return ingestText(text, {
    ...opts,
    sourceName: opts.sourceName ?? url,
    metadata: { url, ...opts.metadata },
  });
}
