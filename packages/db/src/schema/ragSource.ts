/**
 * rag_source — sorgenti indicizzate nel knowledge base RAG.
 *
 * Traccia ogni fonte (report PDF, feed JSON, RSS news, file del vault .brain/)
 * con metadati di fiducia e frequenza di aggiornamento.
 *
 * sourceType: 'report' | 'job_agg' | 'news' | 'community' | 'brain'
 *
 * PRIVACY: nessun dato utente — solo metadati di fonti pubbliche o curate.
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
    sourceType:  text("source_type").notNull(),   // 'report' | 'job_agg' | 'news' | 'community' | 'brain'
    format:      text("format").notNull(),        // 'pdf' | 'json' | 'html' | 'rss' | 'markdown'
    obsidianPath: text("obsidian_path"),          // path relativo per source 'brain' es. ".brain/20_Product/Subsystems/Wendy.md"
    trustScore:  real("trust_score").notNull().default(0.7), // 0.0–1.0
    geography:   text("geography").array().notNull().default([]),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lastIngestedAt: timestamp("last_ingested_at", { withTimezone: true }),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    typeIdx:     index("rag_sources_type_idx").on(t.sourceType),
    nameIdx:     index("rag_sources_name_idx").on(t.name),
    obsidianIdx: index("rag_sources_obsidian_idx").on(t.obsidianPath),
  }),
);

export type RagSource    = typeof ragSourcesTable.$inferSelect;
export type NewRagSource = typeof ragSourcesTable.$inferInsert;
