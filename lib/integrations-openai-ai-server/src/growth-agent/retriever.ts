/**
 * Retriever — semantic search over the knowledge graph.
 *
 * TWO MODES controlled by the PGVECTOR env var:
 *
 *   PGVECTOR=false (default):
 *     Loads all user embeddings from DB → cosine similarity in JS.
 *     Works immediately, no migration needed.
 *     Performance: fine up to ~5000 chunks per user.
 *
 *   PGVECTOR=true:
 *     Runs a single SQL query using the pgvector <=> (cosine distance) operator.
 *     Requires: run lib/db/migrations/add-pgvector.sql first.
 *     Performance: scales to millions of chunks with HNSW index.
 *
 * Switching modes: set PGVECTOR=true in .env after running the SQL migration.
 * No code changes needed — just the env var.
 */
import { db, pool } from "@workspace/db";
import { knowledgeNodesTable } from "@workspace/db";
import { eq, and, isNotNull, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { embedText } from "./embedder";
import { EMBEDDING_DIMS } from "./embedder";

export interface RetrievedChunk {
  id: number;
  content: string;
  source: string;
  sourceType: "document" | "persona_example" | "web" | "user_note";
  score: number;
  metadata: Record<string, unknown>;
}

// JS cosine (fallback mode)
function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

// ── pgvector mode ─────────────────────────────────────────────────────────────
async function retrieveWithPgvector(
  queryEmbedding: number[],
  userId: number,
  topK: number,
  minScore: number,
  sourceTypes?: RetrievedChunk["sourceType"][],
): Promise<RetrievedChunk[]> {
  // Cast the JS array to a pgvector literal: '[0.1, 0.2, ...]'
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;

  // 1 - (cosine distance) = cosine similarity
  // The <=> operator returns distance (0=identical, 2=opposite)
  // so similarity = 1 - distance/2 for normalized vectors,
  // but OpenAI embeddings ARE L2-normalised, so 1 - (v <=> q)/2 ≈ cosine sim.
  const sourceFilter = sourceTypes && sourceTypes.length > 0
    ? `AND type = ANY(ARRAY[${sourceTypes.map((t) => `'${t}'`).join(",")}])`
    : "";

  const rows = await pool.query<{
    id: number;
    content: string;
    type: string;
    metadata: Record<string, unknown>;
    score: number;
  }>(
    `SELECT
       id,
       content,
       type,
       metadata,
       1 - (embedding_vec <=> $1::vector) AS score
     FROM knowledge_nodes
     WHERE user_id = $2
       AND embedding_vec IS NOT NULL
       ${sourceFilter}
       AND 1 - (embedding_vec <=> $1::vector) >= $3
     ORDER BY embedding_vec <=> $1::vector
     LIMIT $4`,
    [vectorLiteral, userId, minScore, topK],
  );

  return rows.rows.map((r) => ({
    id: r.id,
    content: r.content ?? "",
    source: (r.metadata?.["source"] as string) ?? "unknown",
    sourceType: (r.type as RetrievedChunk["sourceType"]) ?? "document",
    score: r.score,
    metadata: r.metadata ?? {},
  }));
}

// ── JS fallback mode ──────────────────────────────────────────────────────────
async function retrieveWithJs(
  queryEmbedding: number[],
  userId: number,
  topK: number,
  minScore: number,
  sourceTypes?: RetrievedChunk["sourceType"][],
): Promise<RetrievedChunk[]> {
  const nodes = await db
    .select()
    .from(knowledgeNodesTable)
    .where(
      and(
        eq(knowledgeNodesTable.userId, userId),
        isNotNull(knowledgeNodesTable.embedding),
      ),
    );

  return nodes
    .filter((n) => {
      const emb = n.embedding as number[] | null;
      if (!emb || emb.length !== queryEmbedding.length) return false;
      if (sourceTypes && !sourceTypes.includes((n.type as RetrievedChunk["sourceType"]) ?? "document")) return false;
      return true;
    })
    .map((n) => ({
      id: n.id,
      content: n.content ?? "",
      source: (n.metadata as Record<string, unknown>)?.["source"] as string ?? "unknown",
      sourceType: (n.type as RetrievedChunk["sourceType"]) ?? "document",
      score: cosine(queryEmbedding, n.embedding as number[]),
      metadata: (n.metadata as Record<string, unknown>) ?? {},
    }))
    .filter((n) => n.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ── Public API ────────────────────────────────────────────────────────────────
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
  const usePgvector = process.env.PGVECTOR === "true";

  if (usePgvector) {
    return retrieveWithPgvector(queryEmbedding, userId, topK, minScore, sourceTypes);
  }
  return retrieveWithJs(queryEmbedding, userId, topK, minScore, sourceTypes);
}
