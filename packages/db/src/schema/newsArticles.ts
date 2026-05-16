import { pgTable, serial, text, timestamp, real, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { vector } from "../custom-types";

export const newsArticlesTable = pgTable(
  "news_articles",
  {
    id: serial("id").primaryKey(),
    embedding: vector("embedding", { dimensions: 1536 }),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    urlHash: text("url_hash").notNull().unique(),
    source: text("source").notNull().default(""),
    summary: text("summary").notNull().default(""),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    sectorNames: text("sector_names").array().notNull().default(sql`'{}'::text[]`),
    category: text("category").notNull().default("general"),
    relevanceScore: real("relevance_score").notNull().default(0),
    searchQuery: text("search_query"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    urlHashIdx: index("news_articles_url_hash_idx").on(t.urlHash),
    publishedAtIdx: index("news_articles_published_at_idx").on(t.publishedAt),
    createdAtIdx: index("news_articles_created_at_idx").on(t.createdAt),
  }),
);

export type NewsArticle = typeof newsArticlesTable.$inferSelect;
export type NewNewsArticle = typeof newsArticlesTable.$inferInsert;
