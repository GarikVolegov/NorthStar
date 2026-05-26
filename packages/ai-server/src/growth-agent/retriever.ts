/**
 * Retriever v2 - adds 'platform_content' sourceType.
 *
 * sourceTypes:
 *   'document'         - user-uploaded PDFs, notes
 *   'persona_example'  - curated coaching examples
 *   'web'              - live web search results cached as nodes
 *   'user_note'        - user free-form notes
 *   'platform_content' - NorthStar courses, articles, career cards
 */
import { db, pool } from "@workspace/db";
import { knowledgeNodesTable } from "@workspace/db";
import { eq, and, isNotNull } from "drizzle-orm";
import CircuitBreaker from "opossum";
import { embedText } from "./embedder";
import { logger } from "../logger";
import { ragConfig } from "../config/rag";
import { recordRagFallback, recordRagJsLimitHit, recordRagRetrieve } from "../metrics";
import { recordRagAlertSample } from "../rag/alerts";
import { startSpan } from "../tracing";

export type SourceType =
  | "document"
  | "persona_example"
  | "web"
  | "user_note"
  | "platform_content"
  | "rabbit_kb";

export interface RetrievedChunk {
  id: number;
  content: string;
  source: string;
  sourceType: SourceType;
  score: number;
  metadata: Record<string, unknown>;
}

type PgvectorRow = {
  id: number;
  content: string | null;
  type: string | null;
  metadata: Record<string, unknown> | null;
  score: number;
};

type JsKnowledgeNode = typeof knowledgeNodesTable.$inferSelect;

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
}

export function validateQueryEmbedding(
  embedding: number[],
  expectedDims = ragConfig.embeddingDims,
): void {
  if (!Array.isArray(embedding)) {
    throw new Error("Invalid query embedding: expected an array");
  }
  if (embedding.length !== expectedDims) {
    throw new Error(`Invalid query embedding: expected ${expectedDims} dims, got ${embedding.length}`);
  }
  const invalidIndex = embedding.findIndex((value) => !Number.isFinite(value));
  if (invalidIndex !== -1) {
    throw new Error(`Invalid query embedding: non-finite value at index ${invalidIndex}`);
  }
}

/**
 * Safety wrapper: rejects if the inner promise takes longer than `ms`.
 */
export function retrieverWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`retriever timeout after ${ms}ms`)), ms),
    ),
  ]);
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

  const userFilter =
    globalUserId != null
      ? `AND (user_id = $2 OR user_id = $5)`
      : `AND user_id = $2`;

  const params: unknown[] = [vectorLiteral, userId, minScore, topK];
  if (globalUserId != null) params.push(globalUserId);
  const sourceFilter =
    sourceTypes && sourceTypes.length > 0
      ? `AND type = ANY($${params.length + 1}::text[])`
      : "";
  if (sourceTypes && sourceTypes.length > 0) params.push(sourceTypes);

  const result = await pool.query<PgvectorRow>(
    `SELECT
        id,
        content,
        type,
        metadata,
        1 - (embedding_vec <=> $1::vector) AS score
      FROM knowledge_nodes
      WHERE 1=1
        ${userFilter}
        AND embedding_vec IS NOT NULL
        ${sourceFilter}
        AND 1 - (embedding_vec <=> $1::vector) >= $3
      ORDER BY embedding_vec <=> $1::vector
      LIMIT $4`,
    params,
  );

  return result.rows.map((row) => ({
    id: row.id,
    content: row.content ?? "",
    source: (row.metadata?.["source"] as string) ?? "unknown",
    sourceType: (row.type as SourceType) ?? "document",
    score: row.score,
    metadata: row.metadata ?? {},
  }));
}

const pgvectorBreaker = new CircuitBreaker(
  async (...args: unknown[]) => {
    const [
      queryEmbedding,
      userId,
      topK,
      minScore,
      sourceTypes,
      globalUserId,
    ] = args as [
      number[],
      number,
      number,
      number,
      SourceType[] | undefined,
      number | undefined,
    ];
    return retrieveWithPgvector(queryEmbedding, userId, topK, minScore, sourceTypes, globalUserId);
  },
  {
    timeout: ragConfig.retriever.pgvectorCircuit.timeoutMs,
    errorThresholdPercentage: ragConfig.retriever.pgvectorCircuit.errorThresholdPercentage,
    resetTimeout: ragConfig.retriever.pgvectorCircuit.resetTimeoutMs,
  },
);

pgvectorBreaker.on("open", () => {
  logger.warn("RAG pgvector circuit breaker opened");
});

pgvectorBreaker.on("halfOpen", () => {
  logger.info("RAG pgvector circuit breaker half-open");
});

pgvectorBreaker.on("close", () => {
  logger.info("RAG pgvector circuit breaker closed");
});

async function retrieveWithJs(
  queryEmbedding: number[],
  userId: number,
  topK: number,
  minScore: number,
  sourceTypes?: SourceType[],
): Promise<RetrievedChunk[]> {
  const nodes: JsKnowledgeNode[] = [];
  const pageSize = ragConfig.retriever.jsPageSize;
  let hitPaginationCap = false;

  for (let page = 0; page < ragConfig.retriever.jsMaxPages; page++) {
    const offset = page * pageSize;
    const pageQuery = db
      .select()
      .from(knowledgeNodesTable)
      .where(
        and(
          eq(knowledgeNodesTable.userId, userId),
          isNotNull(knowledgeNodesTable.embedding),
        ),
      )
      .limit(pageSize);

    const pageRows =
      "offset" in pageQuery && typeof pageQuery.offset === "function"
        ? await pageQuery.offset(offset)
        : page === 0
          ? await pageQuery
          : [];

    nodes.push(...pageRows);
    if (pageRows.length < pageSize) break;
    hitPaginationCap = page === ragConfig.retriever.jsMaxPages - 1;
  }

  if (hitPaginationCap) {
    recordRagJsLimitHit();
    logger.warn(
      { userId, sourceTypes, rows: nodes.length },
      "JS retriever hit pagination cap - results may be incomplete",
    );
  }

  return nodes
    .filter((node) => {
      const emb = node.embedding as number[] | null;
      if (!emb || emb.length !== queryEmbedding.length) return false;
      if (
        sourceTypes &&
        !sourceTypes.includes((node.type as SourceType) ?? "document")
      ) {
        return false;
      }
      return true;
    })
    .map((node) => ({
      id: node.id,
      content: node.content ?? "",
      source: node.title ?? node.url ?? "unknown",
      sourceType: (node.type as SourceType) ?? "document",
      score: cosine(queryEmbedding, node.embedding as number[]),
      metadata: {},
    }))
    .filter((node) => node.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * retrieve() - public API.
 *
 * Platform content (type='platform_content') lives under userId=0 in the DB
 * so it is accessible to all users without duplication.
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
  const {
    topK = ragConfig.retriever.defaultTopK,
    minScore = ragConfig.retriever.defaultMinScore,
    sourceTypes,
  } = opts;
  const startedAt = Date.now();
  const span = startSpan("rag.retrieve", {
    "rag.user_id": userId,
    "rag.top_k": topK,
    "rag.min_score": minScore,
    "rag.source_types": sourceTypes?.join(",") ?? "all",
  });

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embedText(query);
    validateQueryEmbedding(queryEmbedding);
  } catch (err) {
    recordRagRetrieve("none", "error", (Date.now() - startedAt) / 1000);
    recordRagAlertSample({ fallback: false, empty: true });
    span.recordException(err);
    span.setStatus({ code: 2, message: String(err) });
    span.end();
    throw err;
  }

  const needsPlatform = !sourceTypes || sourceTypes.includes("platform_content");
  const platformUserId = 0;
  let usedFallback = false;

  try {
    const result = (await retrieverWithTimeout(
      pgvectorBreaker.fire(
        queryEmbedding,
        userId,
        topK,
        minScore,
        sourceTypes,
        needsPlatform ? platformUserId : undefined,
      ),
      ragConfig.retriever.pgvectorTimeoutMs,
    )) as RetrievedChunk[];
    const resultLabel = result.length === 0 ? "empty" : "ok";
    recordRagRetrieve("pgvector", resultLabel, (Date.now() - startedAt) / 1000, result.map((row) => row.score));
    recordRagAlertSample({ fallback: false, empty: result.length === 0 });
    span.setAttribute("rag.backend", "pgvector");
    span.setAttribute("rag.result_count", result.length);
    span.end();
    return result;
  } catch (pgErr) {
    usedFallback = true;
    recordRagFallback(pgErr instanceof Error ? pgErr.message : "unknown");
    logger.warn({ err: pgErr }, "pgvector unavailable - falling back to JS retriever");
  }

  try {
    const result = await retrieverWithTimeout(
      retrieveWithJs(queryEmbedding, userId, topK, minScore, sourceTypes),
      ragConfig.retriever.jsFallbackTimeoutMs,
    );
    const resultLabel = result.length === 0 ? "empty" : "ok";
    recordRagRetrieve("js", resultLabel, (Date.now() - startedAt) / 1000, result.map((row) => row.score));
    recordRagAlertSample({ fallback: usedFallback, empty: result.length === 0 });
    span.setAttribute("rag.backend", "js");
    span.setAttribute("rag.fallback", usedFallback);
    span.setAttribute("rag.result_count", result.length);
    span.end();
    return result;
  } catch (err) {
    recordRagRetrieve("none", "error", (Date.now() - startedAt) / 1000);
    recordRagAlertSample({ fallback: usedFallback, empty: true });
    span.recordException(err);
    span.setStatus({ code: 2, message: String(err) });
    span.end();
    logger.warn({ err }, "JS fallback timeout/error - returning empty");
    return [];
  }
}
