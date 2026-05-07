/**
 * Retriever — cosine similarity search over the knowledge graph.
 *
 * Uses knowledgeNodesTable which stores embeddings as jsonb number[].
 * For pgvector upgrade path, swap the similarity function with a SQL operator.
 *
 * Returned chunks include source metadata so the agent can cite them.
 */
import { db } from "@workspace/db";
import { knowledgeNodesTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { embedText } from "./embedder";

export interface RetrievedChunk {
  id: number;
  content: string;
  source: string;
  sourceType: "document" | "persona_example" | "web" | "user_note";
  score: number;       // cosine similarity 0-1
  metadata: Record<string, unknown>;
}

/** Cosine similarity between two equal-length vectors */
function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

export async function retrieve(
  query: string,
  userId: number,
  opts: {
    topK?: number;
    minScore?: number;
    sourceTypes?: RetrievedChunk["sourceType"][];
  } = {},
): Promise<RetrievedChunk[]> {
  const { topK = 6, minScore = 0.35, sourceTypes } = opts;

  const queryEmbedding = await embedText(query);

  // Fetch all nodes for this user that have an embedding
  // (In production with pgvector, push this to SQL with <=> operator)
  const nodes = await db
    .select()
    .from(knowledgeNodesTable)
    .where(
      and(
        eq(knowledgeNodesTable.userId, userId),
        isNotNull(knowledgeNodesTable.embedding),
      ),
    );

  const scored = nodes
    .filter((n) => {
      const emb = n.embedding as number[] | null;
      if (!emb || emb.length !== queryEmbedding.length) return false;
      if (sourceTypes && !sourceTypes.includes((n.nodeType as RetrievedChunk["sourceType"]) ?? "document")) return false;
      return true;
    })
    .map((n) => ({
      id: n.id,
      content: n.content ?? "",
      source: (n.metadata as Record<string, unknown>)?.["source"] as string ?? "unknown",
      sourceType: (n.nodeType as RetrievedChunk["sourceType"]) ?? "document",
      score: cosine(queryEmbedding, n.embedding as number[]),
      metadata: (n.metadata as Record<string, unknown>) ?? {},
    }))
    .filter((n) => n.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}
