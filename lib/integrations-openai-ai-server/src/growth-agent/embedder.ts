/**
 * Embedder — chunks text and generates OpenAI embeddings.
 *
 * Uses text-embedding-3-small (1536 dims, fast, cheap).
 * Chunks by paragraph with overlap so long documents don't lose context
 * at boundaries.
 */
import { openai } from "../client";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMS = 1536;
const CHUNK_SIZE = 600;   // tokens approx (chars / 4)
const CHUNK_OVERLAP = 80; // overlap between consecutive chunks

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
  const res = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.slice(0, 8000), // safety trim
  });
  return res.data[0].embedding;
}

/** Embed multiple strings in batches of 100 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH = 100;
  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    results.push(...res.data.map((d) => d.embedding));
  }
  return results;
}
