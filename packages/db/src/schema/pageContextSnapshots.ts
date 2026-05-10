/**
 * page_context_snapshots
 *
 * Stores a snapshot of the app page the user was on when they asked
 * Wendy a context-aware question. Used for:
 *   - Injecting page state into the AI prompt (via pageData JSON)
 *   - Audit trail / replay of contextual interactions
 *
 * pageId examples: 'riasec-results' | 'cv-builder' | 'career-detail' | 'dashboard'
 */
import {
  pgTable, serial, integer, varchar, jsonb, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pageContextSnapshotsTable = pgTable(
  "page_context_snapshots",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** Stable identifier for the page (e.g. 'riasec-results', 'cv-builder') */
    pageId: varchar("page_id", { length: 64 }).notNull(),
    /** Arbitrary JSON blob: test scores, career name, CV sections, etc. */
    pageData: jsonb("page_data").notNull().default({}),
    /** The message that was pre-filled from this context (for audit) */
    promptUsed: varchar("prompt_used", { length: 512 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("page_context_snapshots_user_idx").on(t.userId),
    pageIdx: index("page_context_snapshots_page_idx").on(t.pageId),
  }),
);

export type PageContextSnapshot = typeof pageContextSnapshotsTable.$inferSelect;
export type NewPageContextSnapshot = typeof pageContextSnapshotsTable.$inferInsert;
