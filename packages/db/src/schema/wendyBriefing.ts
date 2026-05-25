/**
 * wendy_briefings — briefing periodici generati da Wendy per l'utente.
 *
 * type:
 *   daily   → generato ogni mattina (solo piano Pro+)
 *   weekly  → generato ogni lunedì (Pro+, disponibile anche free 1/settimana)
 *   manual  → generato on-demand dall'utente
 *
 * PRIVACY:
 *   - content contiene markdown generato da Wendy — no PII diretto
 *   - userId con SET NULL su delete (GDPR Art. 17)
 */
import {
  pgTable, serial, integer, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const wendyBriefingsTable = pgTable(
  "wendy_briefings",
  {
    id:       serial("id").primaryKey(),
    userId:   integer("user_id")
                .notNull()
                .references(() => usersTable.id, { onDelete: "cascade" }),

    type:     text("type", {
                enum: ["daily", "weekly", "manual"],
              }).notNull(),
    period:   text("period").notNull(),         // "2025-W22" (weekly) | "2025-01-15" (daily)

    content:  text("content").notNull(),        // markdown del briefing
    readAt:   timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:    index("wendy_briefings_user_idx").on(t.userId),
    periodIdx:  index("wendy_briefings_period_idx").on(t.userId, t.period),
    typeIdx:    index("wendy_briefings_type_idx").on(t.type, t.createdAt),
  }),
);

export type WendyBriefing    = typeof wendyBriefingsTable.$inferSelect;
export type NewWendyBriefing = typeof wendyBriefingsTable.$inferInsert;
