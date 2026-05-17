/**
 * weak_signals — segnali deboli di professioni e skill emergenti.
 *
 * Rileva tendenze PRIMA che diventino mainstream aggregando segnali
 * da job board, community, trend e corsi emergenti.
 *
 * PRIVACY: nessun dato utente — aggregati anonimi di mercato.
 */
import {
  pgTable, serial, text, real, timestamp, jsonb, index,
} from "drizzle-orm/pg-core";

export const weakSignalsTable = pgTable(
  "weak_signals",
  {
    id:          serial("id").primaryKey(),
    signalType:  text("signal_type", {
                   enum: ["new_job_title", "skill_cooccurrence", "new_course", "community_growth", "startup_hiring", "search_trend"],
                 }).notNull(),
    title:       text("title").notNull(),          // "AI Behavioural Designer"
    description: text("description").notNull(),

    // Fonti da cui proviene il segnale (id o nome)
    sources:     text("sources").array().notNull().default([]),

    // Score composito 0–1 (job_postings×0.4 + community×0.25 + trends×0.2 + sources×0.15)
    strength:    real("strength").notNull().default(0),

    // Dimensioni geografiche e di dominio
    geographies:     text("geographies").array().notNull().default([]),
    linkedSectorIds: text("linked_sector_ids").array().notNull().default([]),
    linkedRoleIds:   text("linked_role_ids").array().notNull().default([]),
    linkedSkillIds:  text("linked_skill_ids").array().notNull().default([]),

    // Stato del segnale nel ciclo di vita
    status: text("status", {
              enum: ["emerging", "confirmed", "mainstream", "faded"],
            }).notNull().default("emerging"),

    // Evidenza strutturata per la transizione di stato
    confirmationEvidence: jsonb("confirmation_evidence")
                            .$type<{
                              jobPostingCount?:     number;
                              communityMentions?:   number;
                              googleTrendsScore?:   number;
                              courseCount?:         number;
                              startupHiringCount?:  number;
                            }>(),

    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt:  timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx:   index("weak_signals_status_idx").on(t.status),
    strengthIdx: index("weak_signals_strength_idx").on(t.strength),
    typeIdx:     index("weak_signals_type_idx").on(t.signalType),
    seenIdx:     index("weak_signals_seen_idx").on(t.lastSeenAt),
  }),
);

export type WeakSignal    = typeof weakSignalsTable.$inferSelect;
export type NewWeakSignal = typeof weakSignalsTable.$inferInsert;
