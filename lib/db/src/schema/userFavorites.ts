import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const userFavoritesTable = pgTable("user_favorites", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type", { enum: ["sector", "news"] }).notNull(),
  sectorId: integer("sector_id"),
  articleUrl: text("article_url"),
  articleTitle: text("article_title"),
  articleDescription: text("article_description"),
  articleSource: text("article_source"),
  articleImage: text("article_image"),
  articleCategory: text("article_category"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserFavorite = typeof userFavoritesTable.$inferSelect;
