/**
 * Retriever v2 — adds 'platform_content' sourceType.
 *
 * sourceTypes:
 *   'document'         — user-uploaded PDFs, notes
 *   'persona_example'  — curated coaching examples
 *   'web'              — live web search results cached as nodes
 *   'user_note'        — user free-form notes
 *   'platform_content' — NorthStar courses, articles, career cards (NEW)
 *
 * TWO MODES controlled by PGVECTOR env var (unchanged from v1).
 */
import { db } from "@workspace/db";
import { knowledgeNodesTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { embedText } from "./embedder";
import { EMBEDDING_DIMS } from "./embedder";
import { logger } from "../logger";

export type SourceType =
  | "document"
  | "persona_example"
  | "web"
  | "user_note"
  | "platform_content"; // ← v2: NorthStar authoritative content

export interface RetrievedChunk {
  id: number;
  content: string;
  source: string;
  sourceType: SourceType;
  score: number;
  metadata: Record<string, unknown>;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

async function retrieveWithPgvector(
   queryEmbedding: number[],
   userId: number,
   topK: number,
   minScore: number,
   sourceTypes?: SourceType[],
   globalUserId?: number,
): Promise<RetrievedChunk[]> {
   const vectorLiteral = `[${queryEmbedding.join(",")}]`;
   const sourceFilter = sourceTypes && sourceTypes.length > 0
     ? `AND type = ANY(ARRAY[${sourceTypes.map((t) => `'${t}'`).join(",")}])`
     : "";

   // Platform content is stored under userId=0 (global namespace)
   // User content is stored under the real userId
   const userFilter = globalUserId != null
     ? `AND (user_id = $2 OR user_id = $5)`
     : `AND user_id = $2`;

   const params: unknown[] = [vectorLiteral, userId, minScore, topK];
   if (globalUserId != null) params.push(globalUserId);

   // Use the db instance instead of pool for query execution
   const result = await db.execute<{
     id: number;
     content: string;
     type: string;
     metadata: Record<string, unknown>;
     score: number;
   }>(
     sql`SELECT
        id,
        content,
        type,
        metadata,
        1 - (embedding_vec <=> ${vectorLiteral}::vector) AS score
      FROM knowledge_nodes
      WHERE 1=1
        AND ${userFilter === `AND (user_id = $2 OR user_id = $5)` ? sql`(user_id = ${userId} OR user_id = ${globalUserId})` : sql`user_id = ${userId}`}
        AND embedding_vec IS NOT NULL
        ${sourceTypes && sourceTypes.length > 0 ? sql`AND type = ANY(ARRAY[${sourceTypes.map((t) => `${t}`)})]` : sql``}
        AND 1 - (embedding_vec <=> ${vectorLiteral}::vector) >= ${minScore}
      ORDER BY embedding_vec <=> ${vectorLiteral}::vector
      LIMIT ${topK}`
   );

   return result.rows.map((r) => ({
     id: r.id,
     content: r.content ?? "",
     source: (r.metadata?.["source"] as string) ?? "unknown",
     sourceType: (r.type as SourceType) ?? "document",
     score: r.score,
     metadata: r.metadata ?? {},
   }));
}

async function retrieveWithJs(
  queryEmbedding: number[],
  userId: number,
  topK: number,
  minScore: number,
  sourceTypes?: SourceType[],
): Promise<RetrievedChunk[]> {
  const nodes = await db
    .select()
    .from(knowledgeNodesTable)
    .where(
      and(
        eq(knowledgeNodesTable.userId, userId),
        isNotNull(knowledgeNodesTable.embedding),
      ),
    )
    .limit(200);

  if (nodes.length >= 200) {
    logger.warn({ userId, sourceTypes }, "JS retriever hit 200-row limit — results may be incomplete");
  }

  return nodes
    .filter((n) => {
      const emb = n.embedding as number[] | null;
      if (!emb || emb.length !== queryEmbedding.length) return false;
      if (sourceTypes && !sourceTypes.includes((n.type as SourceType) ?? "document")) return false;
      return true;
    })
    .map((n) => ({
      id: n.id,
      content: n.content ?? "",
      source: n.title ?? n.url ?? "unknown",
      sourceType: (n.type as SourceType) ?? "document",
      score: cosine(queryEmbedding, n.embedding as number[]),
      metadata: {},
    }))
    .filter((n) => n.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Safety wrapper: rejects if the inner promise takes longer than `ms`.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`retriever timeout after ${ms}ms`)), ms),
    ),
  ]);
}

/**
 * retrieve() — public API.
 *
 * Platform content (type='platform_content') lives under userId=0 in the DB
 * so it is accessible to all users without duplication.
 * When sourceTypes includes 'platform_content', the pgvector query
 * automatically widens the userId filter to include userId=0.
 */
export async function retrieve(
  query: string,
  userId: number,
  opts: {
    topK?: number;
    minScore?: number;
    sourceTypes?: SourceType[];
  } = {},
): Promise<RetrievedChunk[]> {
  const { topK = 6, minScore = 0.35, sourceTypes } = opts;
  const queryEmbedding = await embedText(query);

  const needsPlatform = !sourceTypes || sourceTypes.includes("platform_content");
  const PLATFORM_USER_ID = 0; // global namespace

  // Try pgvector first (PostgreSQL vector search), fallback to JS cosine
  try {
    return await retrieveWithPgvector(
      queryEmbedding, userId, topK, minScore, sourceTypes,
      needsPlatform ? PLATFORM_USER_ID : undefined,
    );
  } catch (pgErr) {
    logger.warn({ err: pgErr }, "pgvector unavailable — falling back to JS retriever");
  }
  try {
    return await withTimeout(
      retrieveWithJs(queryEmbedding, userId, topK, minScore, sourceTypes),
      3000,
    );
  } catch (err) {
    logger.warn({ err }, "JS fallback timeout/error — returning empty");
    return [];
  }
}
