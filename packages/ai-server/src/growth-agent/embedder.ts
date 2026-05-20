/**
 * Embedder — chunks text and generates OpenAI embeddings.
 *
 * Uses text-embedding-3-small (1536 dims, fast, cheap).
 * Chunks by paragraph with overlap so long documents don't lose context
 * at boundaries.
 */
import { OpenAI } from "openai";

function getClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
  });
}

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;
const CHUNK_SIZE = 600;   // tokens approx (chars / 4)
const CHUNK_OVERLAP = 80; // overlap between consecutive chunks

export interface EmbedderHealthSnapshot {
  status: "ok" | "unknown" | "fail";
  lastOkAt?: string;
  lastErrorAt?: string;
  lastError?: string;
}

let embedderHealth: EmbedderHealthSnapshot = { status: "unknown" };

function recordEmbedSuccess(): void {
  embedderHealth = {
    status: "ok",
    lastOkAt: new Date().toISOString(),
    ...(embedderHealth.lastErrorAt ? { lastErrorAt: embedderHealth.lastErrorAt } : {}),
    ...(embedderHealth.lastError ? { lastError: embedderHealth.lastError } : {}),
  };
}

function recordEmbedFailure(error: unknown): void {
  embedderHealth = {
    status: "fail",
    ...(embedderHealth.lastOkAt ? { lastOkAt: embedderHealth.lastOkAt } : {}),
    lastErrorAt: new Date().toISOString(),
    lastError: error instanceof Error ? error.message : String(error),
  };
}

export function getEmbedderHealthSnapshot(): EmbedderHealthSnapshot {
  return { ...embedderHealth };
}

/** Split text into overlapping chunks */
export function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + size).join(" ");
    if (chunk.trim()) chunks.push(chunk.trim());
    i += size - overlap;
  }
  return chunks;
}

/** Embed a single string → number[] */
export async function embedText(text: string): Promise<number[]> {
  const client = getClient();
  try {
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    const [first] = res.data;
    if (!first) throw new Error("Embedding provider returned no data");
    recordEmbedSuccess();
    return first.embedding;
  } catch (error) {
    recordEmbedFailure(error);
    throw error;
  }
}

/** Embed multiple strings in batches of 100 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH = 100;
  const client = getClient();
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    try {
      const res = await client.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });
      recordEmbedSuccess();
      results.push(...res.data.map((d) => d.embedding));
    } catch (error) {
      recordEmbedFailure(error);
      throw error;
    }
  }
  return results;
}
