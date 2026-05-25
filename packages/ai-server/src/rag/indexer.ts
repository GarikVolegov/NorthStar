/**
 * indexer.ts — scrive chunk + embedding nella tabella rag_chunks.
 *
 * Usa l'embedder esistente (growth-agent/embedder.ts) che chiama
 * text-embedding-3-small via OpenAI/AI_INTEGRATIONS_OPENAI_API_KEY.
 *
 * PRIVACY: content deve contenere SOLO testo pubblico — nessun PII.
 */
import { db, ragChunksTable, ragSourcesTable } from "@workspace/db";
import { upsertRoutingKey } from "./sparse-retriever";
import { eq } from "drizzle-orm";
import { embedBatch } from "../growth-agent/embedder";
import { logger } from "../logger";

export interface IndexOptions {
  sourceId:    number;
  docType:     "report" | "news" | "job_agg" | "generic";
  geography?:  string[] | undefined;
  sectors?:    string[] | undefined;
  roles?:      string[] | undefined;
  publishedAt?: Date | undefined;
}

export interface IndexResult {
  chunksIndexed: number;
  sourceId:      number;
  durationMs:    number;
}

/**
 * Indicizza un array di testi come chunk in rag_chunks.
 * Cancella i chunk precedenti per lo stesso sourceId prima di reinserire
 * (idempotente — safe da chiamare più volte per la stessa fonte).
 */
export async function indexChunks(
  texts: string[],
  opts: IndexOptions,
): Promise<IndexResult> {
  const t0 = Date.now();

  if (texts.length === 0) {
    return { chunksIndexed: 0, sourceId: opts.sourceId, durationMs: 0 };
  }

  // Verifica che la fonte esista
  const [source] = await db
    .select({ id: ragSourcesTable.id, trustScore: ragSourcesTable.trustScore })
    .from(ragSourcesTable)
    .where(eq(ragSourcesTable.id, opts.sourceId))
    .limit(1);

  if (!source) throw new Error(`[indexer] ragSource ${opts.sourceId} non trovata`);

  // Rimuovi chunk precedenti (re-ingestione idempotente)
  await db.delete(ragChunksTable).where(eq(ragChunksTable.sourceId, opts.sourceId));

  // Genera embedding in batch da 50
  const BATCH = 50;
  let totalInserted = 0;

  for (let b = 0; b < texts.length; b += BATCH) {
    const batchTexts = texts.slice(b, b + BATCH);
    let embeddings: number[][] = [];

    try {
      embeddings = await embedBatch(batchTexts);
    } catch (e) {
      logger.warn({ e, sourceId: opts.sourceId, batch: b }, "[indexer] embedding batch failed — skipping");
      continue;
    }

    const rows = batchTexts.map((content, i) => ({
      sourceId:    opts.sourceId,
      content,
      chunkIndex:  b + i,
      tokenCount:  Math.ceil(content.length / 4),
      embedding:   embeddings[i] ?? null,
      geography:   opts.geography ?? [],
      sectors:     opts.sectors ?? [],
      roles:       opts.roles ?? [],
      trustScore:  source.trustScore,
      publishedAt: opts.publishedAt ?? null,
    }));

    await db.insert(ragChunksTable).values(rows);
    totalInserted += rows.length;
  }

  // Aggiorna lastIngestedAt sulla fonte
  await db
    .update(ragSourcesTable)
    .set({ lastIngestedAt: new Date(), updatedAt: new Date() })
    .where(eq(ragSourcesTable.id, opts.sourceId));

  // Calcola routing key (centroide MSA) — non blocca in caso di errore
  await upsertRoutingKey(opts.sourceId);

  const durationMs = Date.now() - t0;
  logger.info({ sourceId: opts.sourceId, chunksIndexed: totalInserted, durationMs }, "[indexer] indexing complete");

  return { chunksIndexed: totalInserted, sourceId: opts.sourceId, durationMs };
}
