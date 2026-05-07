/**
 * Ingest pipeline — stores text chunks as embedded knowledge nodes.
 *
 * FIX: knowledgeNodesTable uses 'type' as the column name, not 'nodeType'.
 * The retriever reads '.nodeType' which maps to the Drizzle field name
 * (Drizzle camelCases 'node_type' → 'nodeType' if the column were named that,
 * but here the column is just 'type'). Fixed: we insert into 'type' and
 * the retriever now reads 'type' as well.
 *
 * Also fixed: 'title' is NOT NULL in the schema — always set a fallback.
 */
import { db } from "@workspace/db";
import { knowledgeNodesTable } from "@workspace/db";
import { chunkText, embedBatch } from "./embedder";

export type SourceType = "document" | "persona_example" | "user_note" | "web";

export interface IngestOptions {
  userId: number;
  sourceType: SourceType;
  sourceName: string;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  chunksInserted: number;
  sourceType: SourceType;
  sourceName: string;
}

export async function ingestText(
  text: string,
  opts: IngestOptions,
): Promise<IngestResult> {
  const chunks = chunkText(text);
  if (chunks.length === 0) return { chunksInserted: 0, ...opts };

  const embeddings = await embedBatch(chunks);

  const rows = chunks.map((chunk, i) => ({
    userId: opts.userId,
    // FIX: 'type' is the actual DB column (maps to Drizzle field 'type')
    // The retriever checks n.type for sourceType filtering.
    type: opts.sourceType,
    // title is NOT NULL — use sourceName + chunk index as fallback
    title: `${opts.sourceName} [${i + 1}/${chunks.length}]`,
    content: chunk,
    embedding: embeddings[i],
    embeddedText: chunk,
    metadata: {
      source: opts.sourceName,
      chunkIndex: i,
      totalChunks: chunks.length,
      ...opts.metadata,
    },
    sectorId: null,
    x: 0,
    y: 0,
  }));

  // Insert in batches of 50 to avoid max parameter limits
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(knowledgeNodesTable).values(rows.slice(i, i + BATCH));
  }

  return {
    chunksInserted: chunks.length,
    sourceType: opts.sourceType,
    sourceName: opts.sourceName,
  };
}

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

export async function ingestUrl(
  url: string,
  opts: Omit<IngestOptions, "sourceName"> & { sourceName?: string },
): Promise<IngestResult> {
  const res = await fetch(url, {
    headers: { "User-Agent": "NorthStar-GrowthAgent/1.0" },
  });
  if (!res.ok) throw new Error(`[ingest] Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
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
