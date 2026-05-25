/**
 * rag_routing_keys — indice di routing sparso per retrieval a due livelli.
 *
 * Implementa il principio MSA (Memory Sparse Attention): per ogni fonte RAG
 * viene memorizzato un "routing embedding" (media di tutti i chunk embeddings).
 * Il retriever interroga prima questi vettori di routing (O(S) con S = #fonti)
 * per selezionare le fonti più rilevanti, poi cerca nei chunk di quelle fonti
 * soltanto, riducendo il dominio di ricerca da O(C) a O(C/S * k).
 *
 * PRIVACY: nessun dato utente — solo aggregati di testo pubblico.
 */
import { pgTable, integer, timestamp } from "drizzle-orm/pg-core";
import { vector } from "../custom-types";
import { ragSourcesTable } from "./ragSource";

export const ragRoutingKeysTable = pgTable("rag_routing_keys", {
  sourceId: integer("source_id")
    .primaryKey()
    .references(() => ragSourcesTable.id, { onDelete: "cascade" }),

  // Media vettoriale di tutti i chunk embedding della fonte (centroide semantico)
  routingEmbedding: vector("routing_embedding", { dimensions: 1536 }),

  chunkCount: integer("chunk_count").notNull().default(0),

  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type RagRoutingKey    = typeof ragRoutingKeysTable.$inferSelect;
export type NewRagRoutingKey = typeof ragRoutingKeysTable.$inferInsert;
