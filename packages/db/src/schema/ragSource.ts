/**
 * rag_source — sorgenti indicizzate nel knowledge base RAG.
 *
 * Traccia ogni fonte (report PDF, feed JSON, RSS news) con metadati
 * di fiducia e frequenza di aggiornamento.
 *
 * PRIVACY: nessun dato utente — solo metadati di fonti pubbliche.
 */
import {
  pgTable, text, serial, timestamp, real, index,
} from "drizzle-orm/pg-core";

export const ragSourcesTable = pgTable(
  "rag_sources",
  {
    id:          serial("id").primaryKey(),
    name:        text("name").notNull(),          // "WEF Future of Jobs 2025"
    url:         text("url"),                     // URL originale, opzionale
    sourceType:  text("source_type").notNull(),   // 'report' | 'job_agg' | 'news' | 'community'
    format:      text("format").notNull(),        // 'pdf' | 'json' | 'html' | 'rss'
    trustScore:  real("trust_score").notNull().default(0.7), // 0.0–1.0
    geography:   text("geography").array().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true }),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeIdx: index("rag_sources_type_idx").on(t.sourceType),
    nameIdx: index("rag_sources_name_idx").on(t.name),
  }),
);

export type RagSource    = typeof ragSourcesTable.$inferSelect;
export type NewRagSource = typeof ragSourcesTable.$inferInsert;
