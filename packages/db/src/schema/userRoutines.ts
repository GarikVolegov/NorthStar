/**
 * user_routines — routine autonome configurate dall'utente.
 *
 * Ogni routine rappresenta un agente periodico personalizzato:
 *   - job_monitor       → cerca offerte lavoro filtrate per ruolo/città
 *   - market_report     → report settimanale su un settore
 *   - mindset_exercise  → esercizio coaching generato su misura
 *   - growth_briefing   → briefing su progressi obiettivi
 *   - interview_prep    → preparazione colloquio per azienda target
 *
 * Il worker in `apps/server/src/jobs/routine-scheduler.ts` esegue le routine
 * con `next_run_at ≤ now()` e aggiorna `last_run_at` + `next_run_at` dopo ogni run.
 *
 * LIMITI PER PIANO:
 *   - free: max 1 routine attiva
 *   - pro:  max 5 routine attive
 *   - team: illimitate
 *
 * PRIVACY:
 *   - userId con CASCADE su delete (GDPR Art. 17)
 *   - parameters può contenere ruolo/città ma non PII sensibili (no CV, no password)
 */
import {
  pgTable, serial, integer, text, timestamp, boolean, jsonb, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const ROUTINE_TYPES = [
  "job_monitor",
  "market_report",
  "mindset_exercise",
  "growth_briefing",
  "interview_prep",
  "discovery_nudge",
] as const;

export type RoutineType = typeof ROUTINE_TYPES[number];

export const ROUTINE_OUTPUT_CHANNELS = ["email", "in_app", "wendy_context", "all"] as const;
export type RoutineOutputChannel = typeof ROUTINE_OUTPUT_CHANNELS[number];

export const userRoutinesTable = pgTable(
  "user_routines",
  {
    id:            serial("id").primaryKey(),
    userId:        integer("user_id")
                     .notNull()
                     .references(() => usersTable.id, { onDelete: "cascade" }),

    type:          text("type", { enum: ROUTINE_TYPES }).notNull(),

    name:          text("name").notNull(),                     // es. "Job Monitor — Developer a Milano"

    // Cron expression oppure preset human-readable:
    // "daily", "weekly", "every_monday", "every_thursday", "every_2_days"
    // Il worker normalizza i preset a cron prima di calcolare nextRunAt.
    schedule:      text("schedule").notNull(),

    // Parametri specifici per tipo di routine:
    // job_monitor:      { role, city, seniority?, count? }
    // market_report:    { sector, length? }
    // mindset_exercise: { tone?, focus? }
    // growth_briefing:  { includeMetrics? }
    // interview_prep:   { targetCompany, targetRole? }
    parameters:    jsonb("parameters").notNull().default({}),

    outputChannel: text("output_channel", { enum: ROUTINE_OUTPUT_CHANNELS })
                     .notNull()
                     .default("all"),

    active:        boolean("active").notNull().default(true),

    lastRunAt:     timestamp("last_run_at", { withTimezone: true }),
    nextRunAt:     timestamp("next_run_at", { withTimezone: true }),

    createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:    index("user_routines_user_idx").on(t.userId),
    // Indice principale usato dal worker per trovare le routine da eseguire
    activeIdx:  index("user_routines_active_next_idx").on(t.active, t.nextRunAt),
    typeIdx:    index("user_routines_type_idx").on(t.type),
  }),
);

export type UserRoutine    = typeof userRoutinesTable.$inferSelect;
export type NewUserRoutine = typeof userRoutinesTable.$inferInsert;
