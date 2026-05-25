/**
 * rag_chunks — chunk vettoriali per retrieval semantico.
 *
 * Ogni chunk rappresenta un frammento di testo da una fonte RAG,
 * con embedding pgvector per ricerca cosine-similarity.
 *
 * PRIVACY:
 *   - content contiene SOLO testo pubblico (report, news, aggregati anonimi)
 *   - VIETATO indicizzare messaggi utente, profili, o PII
 *   - I job posting vengono aggregati in cluster (no annunci individuali)
 */
import {
  pgTable, serial, text, integer, timestamp, real, index,
} from "drizzle-orm/pg-core";
import { vector } from "../custom-types";
import { ragSourcesTable } from "./ragSource";

export const ragChunksTable = pgTable(
  "rag_chunks",
  {
    id:          serial("id").primaryKey(),
    sourceId:    integer("source_id")
                   .notNull()
                   .references(() => ragSourcesTable.id, { onDelete: "cascade" }),

    // Contenuto testuale del chunk (no PII)
    content:     text("content").notNull(),
    chunkIndex:  integer("chunk_index").notNull(),
    tokenCount:  integer("token_count"),

    // Vettore embedding (text-embedding-3-small = 1536 dims)
    embedding:   vector("embedding", { dimensions: 1536 }),

    // Metadati per filtraggio pre-retrieval
    geography:   text("geography").array().notNull().default([]),
    sectors:     text("sectors").array().notNull().default([]),     // sectorId[] associati
    roles:       text("roles").array().notNull().default([]),       // titoli ruolo liberi
    trustScore:  real("trust_score").notNull().default(0.7),        // ereditato dalla fonte

    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceIdx:     index("rag_chunks_source_idx").on(t.sourceId),
    geographyIdx:  index("rag_chunks_geography_idx").on(t.geography),
    publishedIdx:  index("rag_chunks_published_idx").on(t.publishedAt),
    trustIdx:      index("rag_chunks_trust_idx").on(t.trustScore),
    // Nota: l'indice IVFFlat sul vettore viene aggiunto nella migration SQL manualmente
    // perché Drizzle non supporta ancora `USING ivfflat` nativo.
  }),
);

export type RagChunk    = typeof ragChunksTable.$inferSelect;
export type NewRagChunk = typeof ragChunksTable.$inferInsert;
