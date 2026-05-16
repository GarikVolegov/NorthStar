import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { vector } from "../custom-types";

export const growthArticlesTable = pgTable("growth_articles", {
  id:                 serial("id").primaryKey(),
  title:              text("title").notNull(),
  embedding:          vector("embedding", { dimensions: 1536 }),
  slug:               text("slug").notNull().unique(),
  category:           text("category").notNull(),
  subcategory:        text("subcategory"),
  description:        text("description").notNull(),
  content:            text("content").notNull(),
  tags:               text("tags").array().notNull().default(sql`'{}'::text[]`),
  difficulty:         text("difficulty").notNull().default("base"),
  personalityMatches: text("personality_matches").array().notNull().default(sql`'{}'::text[]`),
  sectorLinks:        text("sector_links").array().notNull().default(sql`'{}'::text[]`),
  status:             text("status").notNull().default("published"),
  readTimeMinutes:    integer("read_time_minutes").notNull().default(3),
  viewCount:          integer("view_count").notNull().default(0),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GrowthArticle = typeof growthArticlesTable.$inferSelect;
export type NewGrowthArticle = typeof growthArticlesTable.$inferInsert;
