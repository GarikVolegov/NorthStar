/**
 * proactive_insights — insight proattivi generati per l'utente.
 *
 * Wendy può surfacciare segnali rilevanti senza che l'utente chieda:
 *   - nuovi segnali deboli nel settore preferito
 *   - gap di skill vs ruolo target
 *   - aggiornamenti al piano di studio
 *   - news rilevanti
 *   - allineamento trend con idee di business
 *
 * PRIVACY:
 *   - userId con SET NULL (GDPR Art. 17)
 *   - body generato da Wendy: no PII diretto, solo testo curatoriale
 *   - max 3 insight non-letti simultanei per utente (prevent spam)
 */
import {
  pgTable, serial, integer, text, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { weakSignalsTable } from "./weakSignal";
import { ragChunksTable } from "./ragChunk";

export const proactiveInsightsTable = pgTable(
  "proactive_insights",
  {
    id:          serial("id").primaryKey(),
    userId:      integer("user_id")
                   .references(() => usersTable.id, { onDelete: "cascade" })
                   .notNull(),

    insightType: text("insight_type", {
                   enum: ["weak_signal", "skill_gap", "plan_update", "news", "trend_alignment"],
                 }).notNull(),

    title:       text("title").notNull(),
    body:        text("body").notNull(),          // testo Wendy — no PII

    ctaLabel:    text("cta_label"),               // "Scopri di più"
    ctaTarget:   text("cta_target"),              // URL relativo o azione

    // Link opzionale all'entità sorgente
    linkedWeakSignalId: integer("linked_weak_signal_id")
                          .references(() => weakSignalsTable.id, { onDelete: "set null" }),
    linkedRagChunkId:   integer("linked_rag_chunk_id")
                          .references(() => ragChunksTable.id, { onDelete: "set null" }),

    readAt:      timestamp("read_at", { withTimezone: true }),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:      index("proactive_insights_user_idx").on(t.userId),
    userUnreadIdx: index("proactive_insights_user_unread_idx").on(t.userId, t.readAt),
    typeIdx:      index("proactive_insights_type_idx").on(t.insightType),
    createdIdx:   index("proactive_insights_created_idx").on(t.createdAt),
  }),
);

export type ProactiveInsight    = typeof proactiveInsightsTable.$inferSelect;
export type NewProactiveInsight = typeof proactiveInsightsTable.$inferInsert;
