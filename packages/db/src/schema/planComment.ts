/**
 * plan_comments — commenti su piani di studio condivisi.
 *
 * isPrivate = true → visibile solo all'autore (usato dai mentor per note interne).
 * PRIVACY: content max 1000 char, validato server-side. Nessun PII inferito.
 */
import {
  pgTable, serial, integer, text, boolean, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { sharedPlansTable } from "./sharedPlan";

export const planCommentsTable = pgTable(
  "plan_comments",
  {
    id:           serial("id").primaryKey(),
    sharedPlanId: integer("shared_plan_id")
                    .notNull()
                    .references(() => sharedPlansTable.id, { onDelete: "cascade" }),
    authorId:     integer("author_id")
                    .notNull()
                    .references(() => usersTable.id, { onDelete: "cascade" }),
    content:      text("content").notNull(),       // max 1000 char
    isPrivate:    boolean("is_private").notNull().default(false),
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:    timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    planIdx:   index("plan_comments_plan_idx").on(t.sharedPlanId),
    authorIdx: index("plan_comments_author_idx").on(t.authorId),
  }),
);

export type PlanComment    = typeof planCommentsTable.$inferSelect;
export type NewPlanComment = typeof planCommentsTable.$inferInsert;
