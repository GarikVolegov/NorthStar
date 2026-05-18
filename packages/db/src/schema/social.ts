import {
  pgTable, serial, integer, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const socialPostsTable = pgTable(
  "social_posts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    visibility: text("visibility", { enum: ["public", "friends"] })
      .notNull()
      .default("public"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("social_posts_user_idx").on(t.userId),
    visibilityIdx: index("social_posts_visibility_idx").on(t.visibility),
    createdAtIdx: index("social_posts_created_at_idx").on(t.createdAt),
  }),
);

export const socialStoriesTable = pgTable(
  "social_stories",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content"),
    mediaUrl: text("media_url"),
    visibility: text("visibility", { enum: ["public", "friends"] })
      .notNull()
      .default("public"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("social_stories_user_idx").on(t.userId),
    expiresAtIdx: index("social_stories_expires_at_idx").on(t.expiresAt),
    visibilityIdx: index("social_stories_visibility_idx").on(t.visibility),
  }),
);

export type SocialPost = typeof socialPostsTable.$inferSelect;
export type NewSocialPost = typeof socialPostsTable.$inferInsert;
export type SocialStory = typeof socialStoriesTable.$inferSelect;
export type NewSocialStory = typeof socialStoriesTable.$inferInsert;
