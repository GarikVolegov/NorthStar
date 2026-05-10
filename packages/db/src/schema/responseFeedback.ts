/**
 * response_feedback
 * ─────────────────
 * Stores user thumbs-up / thumbs-down ratings on individual coach messages.
 *
 * HOW IT FITS:
 *   - sessionId    → joins coach_sessions
 *   - messageIndex → position of the assistant message in the chat history
 *                    (even = user, odd = assistant, so always odd in practice)
 *   - rating       → +1 (positive) or -1 (negative)
 *   - comment      → optional free-text from user (e.g. "troppo vago")
 *
 * HOW IT FEEDS BACK INTO THE SYSTEM:
 *   - supervisor-pattern-analyzer.ts reads negative-rated messages from
 *     supervisor_logs joined on sessionId to prioritise them in weekly analysis.
 *   - analytics route exposes aggregate rating per domain/specialist.
 *
 * UNIQUE CONSTRAINT: one rating per (sessionId, messageIndex) — the user can
 * change their rating (upsert), but cannot leave two conflicting votes.
 */
import {
  pgTable,
  serial,
  integer,
  smallint,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { coachSessionsTable } from "./coachSessions";

export const responseFeedbackTable = pgTable(
  "response_feedback",
  {
    id:           serial("id").primaryKey(),
    sessionId:    integer("session_id")
                    .notNull()
                    .references(() => coachSessionsTable.id, { onDelete: "cascade" }),
    messageIndex: integer("message_index").notNull(), // 0-based index in messages[]
    rating:       smallint("rating").notNull(),       // +1 or -1
    comment:      text("comment"),                    // optional user note
    createdAt:    timestamp("created_at").defaultNow().notNull(),
    updatedAt:    timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqPerMessage: unique("response_feedback_session_msg_uniq").on(
      t.sessionId,
      t.messageIndex,
    ),
  }),
);

export type ResponseFeedback    = typeof responseFeedbackTable.$inferSelect;
export type NewResponseFeedback = typeof responseFeedbackTable.$inferInsert;
