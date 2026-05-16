/**
 * FIXED:
 * - Added FK on objectiveId referencing userObjectivesTable
 * - Added FK on authorId referencing usersTable
 * Both use CASCADE DELETE: comment threads are deleted with their objective/author.
 */
import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { userObjectivesTable } from "./userObjectives";

export const objectiveCommentsTable = pgTable(
  "objective_comments",
  {
    id: serial("id").primaryKey(),
    // FIXED: was bare integer
    objectiveId: integer("objective_id")
      .notNull()
      .references(() => userObjectivesTable.id, { onDelete: "cascade" }),
    // FIXED: was bare integer
    authorId: integer("author_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    reaction: text("reaction"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    // Fast fetch of all comments for a given objective
    objectiveIdx: index("objective_comments_objective_idx").on(t.objectiveId),
  }),
);

export type ObjectiveComment = typeof objectiveCommentsTable.$inferSelect;
