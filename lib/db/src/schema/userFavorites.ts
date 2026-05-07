/**
 * FIXED:
 * - Added userId FK with CASCADE DELETE
 * - Added uniqueIndex on (userId, type, sectorId) to prevent duplicate
 *   sector favorites. News favorites use articleUrl as dedup key.
 * - Added index on userId for per-user favorites queries
 */
import {
  pgTable, serial, integer, text, timestamp, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userFavoritesTable = pgTable(
  "user_favorites",
  {
    id: serial("id").primaryKey(),
    // FIXED: was bare integer
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["sector", "news", "growth"] }).notNull(),
    sectorId: integer("sector_id"),
    articleUrl: text("article_url"),
    articleTitle: text("article_title"),
    articleDescription: text("article_description"),
    articleSource: text("article_source"),
    articleImage: text("article_image"),
    articleCategory: text("article_category"),
    growthArticleId: integer("growth_article_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userIdx: index("user_favorites_user_idx").on(t.userId),
    // FIXED: prevents adding the same sector as favorite twice
    uniqueSectorFav: uniqueIndex("user_favorites_unique_sector").on(
      t.userId,
      t.type,
      t.sectorId,
    ),
  }),
);

export type UserFavorite = typeof userFavoritesTable.$inferSelect;
