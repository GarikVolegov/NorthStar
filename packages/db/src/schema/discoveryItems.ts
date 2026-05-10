/**
 * discovery_items — item raccolti dal DiscoveryCollectorAgent.
 *
 * COLONNE ENRICHMENT (popolate da enricher-agent.ts):
 *   - relevanceScore  float 0-1   quanto è rilevante per NorthStar
 *   - skillTags       text[]      competenze estratte da GPT
 *   - insightText     text        "perché ti riguarda" in italiano
 *   - journeyTypes    text[]      a chi si rivolge (developer, marketer…)
 *   - difficulty      text        easy|medium|advanced (solo formation)
 *   - isEnriched      bool        true dopo l'arricchimento GPT
 *   - enrichedAt      timestamp   quando è stato arricchito
 *   - enrichRetries   int         tentativi falliti (max 3)
 */
import {
  pgTable, serial, text, boolean, timestamp,
  real, index, uniqueIndex, integer,
} from "drizzle-orm/pg-core";

export const discoveryItemsTable = pgTable(
  "discovery_items",
  {
    id:              serial("id").primaryKey(),

    // Classificazione
    type:            text("type").notNull(),          // ItemType
    category:        text("category").notNull().default("news"),
    sectorNames:     text("sector_names").array().notNull().default([]),

    // Contenuto
    title:           text("title").notNull(),
    url:             text("url").notNull(),
    urlHash:         text("url_hash").notNull(),
    source:          text("source").notNull(),
    summary:         text("summary").notNull().default(""),
    imageUrl:        text("image_url"),
    publishedAt:     timestamp("published_at"),

    // Collector metadata
    collectorSource: text("collector_source").notNull().default(""),
    searchQuery:     text("search_query"),

    // ── Enrichment (GPT-4o-mini) ──────────────────────────────────────────
    isEnriched:      boolean("is_enriched").notNull().default(false),
    enrichedAt:      timestamp("enriched_at"),
    enrichRetries:   integer("enrich_retries").notNull().default(0),  // max 3
    relevanceScore:  real("relevance_score").notNull().default(0),
    skillTags:       text("skill_tags").array().default([]),
    insightText:     text("insight_text"),   // "perché ti riguarda" IT
    journeyTypes:    text("journey_types").array().default([]),
    difficulty:      text("difficulty"),     // easy|medium|advanced|null

    // Audit
    createdAt:       timestamp("created_at").notNull().defaultNow(),
    updatedAt:       timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => ([
    uniqueIndex("discovery_items_url_hash_idx").on(t.urlHash),
    index("discovery_items_type_idx").on(t.type),
    index("discovery_items_is_enriched_idx").on(t.isEnriched),
    index("discovery_items_relevance_idx").on(t.relevanceScore),
    index("discovery_items_created_at_idx").on(t.createdAt),
    index("discovery_items_enrich_retries_idx").on(t.enrichRetries),
  ]),
);

export type DiscoveryItem    = typeof discoveryItemsTable.$inferSelect;
export type NewDiscoveryItem = typeof discoveryItemsTable.$inferInsert;
