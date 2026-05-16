import OpenAI from "openai";
import { logger } from "../logger";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

function getClient(): OpenAI {
  return new OpenAI({
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || "https://api.openai.com/v1",
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "",
  });
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  try {
    const cleaned = text.replace(/\s+/g, " ").trim().slice(0, 8000);
    if (!cleaned) return null;

    const openai = getClient();
    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: cleaned,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    return response.data[0]?.embedding ?? null;
  } catch (err) {
    logger.warn({ err }, "embedding generation failed");
    return null;
  }
}

export async function generateEmbeddingsBatch(
  items: Array<{ id: string | number; text: string }>,
): Promise<Array<{ id: string | number; embedding: number[] | null }>> {
  const results: Array<{ id: string | number; embedding: number[] | null }> = [];

  for (let i = 0; i < items.length; i += 20) {
    const batch = items.slice(i, i + 20);
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        const embedding = await generateEmbedding(item.text);
        return { id: item.id, embedding };
      }),
    );

    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
      } else {
        results.push({ id: batch[results.length]?.id ?? "unknown", embedding: null });
      }
    }
  }

  return results;
}

export function buildEmbeddingText(
  parts: Array<{ label: string; value: string | string[] | null | undefined }>,
): string {
  return parts
    .filter((p) => p.value != null && (Array.isArray(p.value) ? p.value.length > 0 : p.value.length > 0))
    .map((p) => {
      const val = Array.isArray(p.value) ? p.value.join(", ") : String(p.value);
      return `${p.label}: ${val}`;
    })
    .join(". ");
}
