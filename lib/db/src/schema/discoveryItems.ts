/**
 * discovery_items — Discovery Agent System.
 *
 * Central table for all content collected by the DiscoveryCollectorAgent:
 * news, job opportunities, courses/formations, growth articles, sector trends.
 *
 * Replaces the simpler news_articles table for agentic use.
 * news_articles is kept for backward compatibility.
 *
 * CONTENT TYPES:
 *   news         — articoli di notizie (tech, mercato lavoro, macro)
 *   opportunity  — offerte lavoro, grant, bandi, acceleratori
 *   formation    — corsi, certificazioni, tutorial, bootcamp
 *   growth       — articoli crescita personale, mindset, abitudini
 *   sector_trend — trend emergenti in settori specifici
 *
 * ENRICHMENT FIELDS (populated by enricher-agent.ts):
 *   relevanceScore  0–1: GPT-computed relevance for NorthStar users
 *   skillTags       string[]: competenze menzionate/richieste
 *   insightText     string: 1-2 sentence GPT insight ("perché ti riguarda")
 *   difficulty      easy|medium|advanced (for formation type)
 *   journeyTypes    string[]: which journeyTypes this is relevant for
 *
 * PERSONALIZATION FIELDS:
 *   sectorNames   string[]: settori coinvolti
 *   category      string:   fine-grained category within type
 */
import {
  pgTable,
  serial,
  text,
  real,
  boolean,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const discoveryItemTypeEnum = pgEnum("discovery_item_type", [
  "news",
  "opportunity",
  "formation",
  "growth",
  "sector_trend",
]);

export const discoveryItemDifficultyEnum = pgEnum("discovery_item_difficulty", [
  "easy",
  "medium",
  "advanced",
]);

export const discoveryItemsTable = pgTable(
  "discovery_items",
  {
    id:             serial("id").primaryKey(),

    // ── Core content ───────────────────────────────────────────────────
    type:           discoveryItemTypeEnum("type").notNull(),
    title:          text("title").notNull(),
    url:            text("url").notNull().unique(),
    urlHash:        text("url_hash").notNull().unique(),
    source:         text("source").notNull().default(""),
    summary:        text("summary").notNull().default(""),
    imageUrl:       text("image_url"),
    publishedAt:    timestamp("published_at", { withTimezone: true }),

    // ── Classification ───────────────────────────────────────────────
    category:       text("category").notNull().default("general"),
    sectorNames:    text("sector_names").array().notNull().default(sql`'{}'::text[]`),
    journeyTypes:   jsonb("journey_types").$type<string[]>().default([]),

    // ── Enrichment (populated by enricher-agent) ──────────────────────
    relevanceScore: real("relevance_score").notNull().default(0),
    skillTags:      jsonb("skill_tags").$type<string[]>().default([]),
    insightText:    text("insight_text"),           // "perché ti riguarda"
    difficulty:     discoveryItemDifficultyEnum("difficulty"),
    isEnriched:     boolean("is_enriched").notNull().default(false),

    // ── Collection metadata ──────────────────────────────────────────
    collectorSource: text("collector_source"),      // "hackernews", "devto", etc.
    searchQuery:    text("search_query"),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    urlHashIdx:     index("discovery_items_url_hash_idx").on(t.urlHash),
    typeIdx:        index("discovery_items_type_idx").on(t.type),
    publishedAtIdx: index("discovery_items_published_at_idx").on(t.publishedAt),
    relevanceIdx:   index("discovery_items_relevance_idx").on(t.relevanceScore),
    enrichedIdx:    index("discovery_items_enriched_idx").on(t.isEnriched),
  }),
);

export type DiscoveryItem    = typeof discoveryItemsTable.$inferSelect;
export type NewDiscoveryItem = typeof discoveryItemsTable.$inferInsert;
