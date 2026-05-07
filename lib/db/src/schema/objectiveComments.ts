import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const objectiveCommentsTable = pgTable("objective_comments", {
  id: serial("id").primaryKey(),
  objectiveId: integer("objective_id").notNull(),
  authorId: integer("author_id").notNull(),
  content: text("content").notNull(),
  reaction: text("reaction"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ObjectiveComment = typeof objectiveCommentsTable.$inferSelect;
