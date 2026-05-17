/**
 * wendy_feedback — raccoglie 👍/👎 sulle risposte di Wendy.
 *
 * Legato ad ai_request_log tramite request_id (FK logica non constraint,
 * per evitare dipendenze cross-tabella su delete).
 *
 * PRIVACY:
 *   - userId nullable con SET NULL (GDPR Art. 17 — diritto all'oblio)
 *   - Nessun contenuto testuale del messaggio — solo categorie predefinite
 *   - reason è un enum chiuso: niente testo libero
 */
import {
  pgTable, serial, integer, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const wendyFeedbackTable = pgTable(
  "wendy_feedback",
  {
    id:        serial("id").primaryKey(),

    // FK logica (no constraint) — request_id può sopravvivere alla pulizia log
    requestId: text("request_id").notNull(),
    userId:    integer("user_id")
                .references(() => usersTable.id, { onDelete: "set null" }),

    // Voto
    rating:    text("rating", { enum: ["up", "down"] }).notNull(),

    // Motivo del downvote — categoria chiusa per evitare PII in testo libero
    reason:    text("reason", {
                 enum: ["inaccurate", "irrelevant", "too_long", "too_slow", "harmful", "other"],
               }),

    // Contesto di routing snapshot (non-PII, utile per analisi)
    intent:    text("intent"),   // WendyIntent al momento della risposta
    toolsUsed: text("tools_used").array().default([]),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    requestIdx: index("wendy_feedback_request_idx").on(t.requestId),
    userIdx:    index("wendy_feedback_user_idx").on(t.userId),
    ratingIdx:  index("wendy_feedback_rating_idx").on(t.rating, t.createdAt),
  }),
);

export type WendyFeedback    = typeof wendyFeedbackTable.$inferSelect;
export type NewWendyFeedback = typeof wendyFeedbackTable.$inferInsert;
