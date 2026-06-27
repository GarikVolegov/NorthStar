/**
 * session_summaries — Phase 10: session context window.
 *
 * After each coaching session, a GPT-4o-mini call summarises the conversation
 * in 3-4 sentences. The summary is injected into the system prompt of the
 * NEXT session so the coach always has recent context, even after days of
 * inactivity.
 *
 * The summary is stored per (userId, sessionId) and is keyed for fast
 * lookup by userId to find the latest N summaries.
 *
 * FIELDS:
 *   userId     → for fast lookup per user
 *   sessionId  → the session this summary describes (FK coach_sessions)
 *   summary    → 3-4 sentence human-readable summary (max ~500 chars)
 *   keyThemes  → string[] of 2-4 topic tags extracted from the session
 *   mood       → detected emotional tone: positive/neutral/negative/mixed
 *   createdAt  → when the summary was generated
 */
import {
  pgTable,
  serial,
  integer,
  text,
  jsonb,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { coachSessionsTable } from "./coachSessions";
import { usersTable } from "./users";

export const moodEnum = pgEnum("session_mood", ["positive", "neutral", "negative", "mixed"]);

export const sessionSummariesTable = pgTable(
  "session_summaries",
  {
    id:        serial("id").primaryKey(),
    userId:    integer("user_id")
                 .notNull()
                 .references(() => usersTable.id, { onDelete: "cascade" }),
    sessionId: integer("session_id")
                 .notNull()
                 .references(() => coachSessionsTable.id, { onDelete: "cascade" }),
    summary:   text("summary").notNull(),
    keyThemes: jsonb("key_themes").$type<string[]>().default([]),
    mood:      moodEnum("mood").default("neutral"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    // Per-user lookup of the latest N summaries (coach session start, account export).
    userCreatedIdx: index("session_summaries_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type SessionSummary    = typeof sessionSummariesTable.$inferSelect;
export type NewSessionSummary = typeof sessionSummariesTable.$inferInsert;
