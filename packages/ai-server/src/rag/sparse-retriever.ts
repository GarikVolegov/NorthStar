/**
 * sparse-retriever.ts — retrieval a due livelli ispirato a Memory Sparse Attention (MSA).
 *
 * Architettura:
 *   Livello 1 (routing): interroga rag_routing_keys (un vettore per fonte).
 *                        Seleziona le K fonti più vicine semanticamente alla query.
 *   Livello 2 (chunk):   interroga rag_chunks filtrato per le fonti selezionate.
 *                        Restituisce i chunk più rilevanti entro quelle fonti.
 *
 * Multi-hop (Memory Interleave):
 *   1. Retrieval iniziale (due livelli)
 *   2. Estrazione di termini chiave dai chunk ottenuti
 *   3. Retrieval espanso con sub-query derivate
 *   4. Merge + deduplicazione + re-ranking per similarità
 */
import { db, ragChunksTable, ragRoutingKeysTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "../logger";

export interface RagFilters {
  geography?:     string[];
  sourceTypes?:   string[];
  minTrustScore?: number;
  maxAgeMonths?:  number;
}

export interface RagChunkResult {
  content:     string;
  sourceName:  string;
  sourceId:    number;
  publishedAt: string;
  geography:   string[];
  similarity:  number;
  trustScore:  number;
}

// ── Utilità ─────────────────────────────────────────────────────────────────

function vecLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}

function cutoffDate(maxAgeMonths: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - maxAgeMonths);
  return d;
}

/** Deduplicazione per contenuto: rimuove chunk identici, mantiene il più simile. */
function deduplicateChunks(chunks: RagChunkResult[]): RagChunkResult[] {
  const seen = new Set<string>();
  return chunks.filter((c) => {
    const key = c.content.slice(0, 120);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Estrae termini chiave dai chunk per generare sub-query di espansione.
 * Usa euristiche leggere (no LLM) per evitare latenza aggiuntiva.
 * Restituisce al massimo `maxTerms` stringhe.
 */
function extractExpansionTerms(chunks: RagChunkResult[], maxTerms = 3): string[] {
  // Raccoglie parole con iniziale maiuscola (candidati a entità/termini tecnici)
  const termFreq = new Map<string, number>();
  for (const chunk of chunks) {
    const words = chunk.content.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2}/g) ?? [];
    for (const w of words) {
      const term = w.trim();
      if (term.length < 4 || term.length > 40) continue;
      termFreq.set(term, (termFreq.get(term) ?? 0) + 1);
    }
  }
  return [...termFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([term]) => term);
}

// ── Livello 1: routing ───────────────────────────────────────────────────────

/**
 * Interroga rag_routing_keys e restituisce gli source_id più vicini alla query.
 * Fallisce silenziosamente e restituisce [] se la tabella è vuota o mancante.
 */
async function routingLevelQuery(
  queryVec: number[],
  topSources: number,
): Promise<number[]> {
  try {
    const literal = vecLiteral(queryVec);
    const rows = await db.execute<{ source_id: number }>(sql`
      SELECT source_id
      FROM rag_routing_keys
      WHERE routing_embedding IS NOT NULL
      ORDER BY routing_embedding <=> ${literal}::vector
      LIMIT ${topSources}
    `);
    return rows.rows.map((r) => r.source_id);
  } catch (e) {
    logger.debug({ e }, "[sparse-retriever] routing level unavailable — falling back to direct");
    return [];
  }
}

// ── Livello 2: chunk retrieval ───────────────────────────────────────────────

async function chunkLevelQuery(
  queryVec: number[],
  topK: number,
  filters: RagFilters,
  sourceIds?: number[],
): Promise<RagChunkResult[]> {
  const minTrust     = filters.minTrustScore ?? 0.55;
  const maxAge       = filters.maxAgeMonths  ?? 24;
  const cutoff       = cutoffDate(maxAge);
  const literal      = vecLiteral(queryVec);

  const geoFilter        = filters.geography?.length
    ? sql`AND rc.geography && ${filters.geography}::text[]`
    : sql``;
  const sourceTypeFilter = filters.sourceTypes?.length
    ? sql`AND rs.source_type = ANY(${filters.sourceTypes}::text[])`
    : sql``;
  const sourceIdFilter   = sourceIds?.length
    ? sql`AND rc.source_id = ANY(${sourceIds}::integer[])`
    : sql``;

  const rows = await db.execute<{
    id:          number;
    content:     string;
    source_id:   number;
    source_name: string;
    published_at: string | null;
    geography:   string[];
    trust_score: number;
    similarity:  number;
  }>(sql`
    SELECT
      rc.id,
      rc.content,
      rc.source_id,
      rs.name  AS source_name,
      rc.published_at,
      rc.geography,
      rc.trust_score,
      1 - (rc.embedding <=> ${literal}::vector) AS similarity
    FROM rag_chunks rc
    JOIN rag_sources rs ON rc.source_id = rs.id
    WHERE rc.embedding IS NOT NULL
      AND rc.trust_score >= ${minTrust}
      AND (rc.published_at IS NULL OR rc.published_at >= ${cutoff.toISOString()}::timestamptz)
      ${geoFilter}
      ${sourceTypeFilter}
      ${sourceIdFilter}
    ORDER BY rc.embedding <=> ${literal}::vector
    LIMIT ${topK}
  `);

  return rows.rows.map((r) => ({
    content:     r.content,
    sourceName:  r.source_name,
    sourceId:    r.source_id,
    publishedAt: r.published_at ?? "",
    geography:   r.geography,
    similarity:  Math.round(r.similarity * 1000) / 1000,
    trustScore:  r.trust_score,
  }));
}

// ── API pubblica ─────────────────────────────────────────────────────────────

export interface TwoLevelSearchOptions {
  topSources?: number;  // quante fonti selezionare al livello routing (default: 5)
  topK?:       number;  // chunk da restituire (default: 6)
  filters?:    RagFilters;
}

/**
 * Retrieval a due livelli (ispirato a MSA coarse-to-fine):
 *   1. Routing: seleziona le topSources fonti più simili alla query
 *   2. Chunk:   recupera i topK chunk migliori entro quelle fonti
 *
 * Se la tabella routing_keys è vuota o non disponibile, degrada automaticamente
 * al retrieval diretto (comportamento attuale).
 */
export async function twoLevelSearchRag(
  queryVec: number[],
  opts: TwoLevelSearchOptions = {},
): Promise<RagChunkResult[]> {
  const topSources = opts.topSources ?? 5;
  const topK       = Math.min(opts.topK ?? 6, 10);
  const filters    = opts.filters ?? {};

  const sourceIds = await routingLevelQuery(queryVec, topSources);

  if (sourceIds.length === 0) {
    // Fallback: ricerca diretta su tutti i chunk (comportamento precedente)
    return chunkLevelQuery(queryVec, topK, filters);
  }

  const chunks = await chunkLevelQuery(queryVec, topK, filters, sourceIds);

  if (chunks.length < Math.ceil(topK / 2)) {
    // Se il routing ha pre-filtrato troppo aggressivamente, integra con ricerca globale
    const global = await chunkLevelQuery(queryVec, topK, filters);
    return deduplicateChunks([...chunks, ...global]).slice(0, topK);
  }

  return chunks;
}

export interface MultiHopSearchOptions extends TwoLevelSearchOptions {
  hops?:          number;  // numero massimo di hop (default: 2)
  expansionTerms?: number; // termini per hop di espansione (default: 3)
  embedFn:        (text: string) => Promise<number[] | null>;
}

/**
 * Retrieval multi-hop (Memory Interleave pattern di MSA):
 *   Hop 1: retrieval a due livelli sulla query originale
 *   Hop 2: estrae termini chiave dai chunk → nuove sub-query → retrieval aggiuntivo
 *   Merge: deduplicazione + re-ranking per similarità discendente
 *
 * Il secondo hop usa euristiche leggere (no LLM) per estrarre termini,
 * mantenendo la latenza contenuta.
 */
export async function multiHopSearchRag(
  query: string,
  queryVec: number[],
  opts: MultiHopSearchOptions,
): Promise<{ chunks: RagChunkResult[]; hops: number }> {
  const maxHops       = Math.min(opts.hops ?? 2, 3);
  const topK          = Math.min(opts.topK ?? 6, 10);
  const expansionN    = opts.expansionTerms ?? 3;

  // Hop 1
  const hop1 = await twoLevelSearchRag(queryVec, { ...opts, topK });
  if (maxHops === 1 || hop1.length === 0) {
    return { chunks: hop1, hops: 1 };
  }

  // Hop 2: espansione semantica dai risultati del primo hop
  const expansionTerms = extractExpansionTerms(hop1, expansionN);
  if (expansionTerms.length === 0) {
    return { chunks: hop1, hops: 1 };
  }

  const expansionQuery = `${query} ${expansionTerms.join(" ")}`;
  const expansionVec   = await opts.embedFn(expansionQuery).catch(() => null);
  if (!expansionVec) {
    return { chunks: hop1, hops: 1 };
  }

  const hop2 = await twoLevelSearchRag(expansionVec, { ...opts, topK: Math.ceil(topK / 2) });

  const merged = deduplicateChunks([...hop1, ...hop2])
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return { chunks: merged, hops: 2 };
}

// ── Routing key builder (chiamato dall'indexer) ──────────────────────────────

/**
 * Calcola il centroide semantico di tutti i chunk di una fonte e lo salva
 * in rag_routing_keys. Va chiamato al termine dell'indicizzazione.
 */
export async function upsertRoutingKey(sourceId: number): Promise<void> {
  try {
    const chunks = await db
      .select({ embedding: ragChunksTable.embedding })
      .from(ragChunksTable)
      .where(eq(ragChunksTable.sourceId, sourceId));

    const validEmbeddings = chunks
      .map((c) => c.embedding as number[] | null)
      .filter((e): e is number[] => Array.isArray(e) && e.length === 1536);

    if (validEmbeddings.length === 0) return;

    const dims = 1536;
    const mean = new Array<number>(dims).fill(0);
    for (const emb of validEmbeddings) {
      for (let i = 0; i < dims; i++) mean[i] = (mean[i] ?? 0) + (emb[i] ?? 0);
    }
    for (let i = 0; i < dims; i++) mean[i] = (mean[i] ?? 0) / validEmbeddings.length;

    await db
      .insert(ragRoutingKeysTable)
      .values({ sourceId, routingEmbedding: mean, chunkCount: validEmbeddings.length, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: ragRoutingKeysTable.sourceId,
        set: { routingEmbedding: mean, chunkCount: validEmbeddings.length, updatedAt: new Date() },
      });

    logger.info({ sourceId, chunkCount: validEmbeddings.length }, "[sparse-retriever] routing key upserted");
  } catch (e) {
    logger.warn({ e, sourceId }, "[sparse-retriever] upsertRoutingKey failed — non-blocking");
  }
}
