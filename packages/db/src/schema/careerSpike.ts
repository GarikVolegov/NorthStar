/**
 * career_spikes — il "commit reversibile" del percorso indeciso.
 *
 * Quando emerge un'ipotesi, NON si forza un grande impegno: si propone un
 * micro-esperimento di ~2 settimane con un KILL-CRITERION deciso PRIMA. Abbassa
 * la paura ("è un test, non un matrimonio") e fa decidere per bet reversibili.
 *
 * Riusa objectives + calendar (soft-FK) invece di duplicarli.
 * PRIVACY: azioni/criteri sono testo dell'utente — owner-scoped, cascade on
 * user delete, incluso nello sweep GDPR.
 */
import {
  pgTable, serial, integer, text, jsonb, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const CAREER_SPIKE_STATUSES = [
  "active",              // in corso
  "completed_continue",  // alla review: continua (esperienza positiva)
  "completed_kill",      // alla review: stop (testato e scartato — è progresso)
  "abandoned",           // lasciato cadere senza review
] as const;
export type CareerSpikeStatus = typeof CAREER_SPIKE_STATUSES[number];

export interface CareerSpikeOutcome {
  energy?: number;    // -1..1 quanto ti ha dato/tolto energia
  learned?: string;   // cosa hai imparato
  decision?: string;  // nota libera sulla decisione
}

export const careerSpikesTable = pgTable(
  "career_spikes",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    hypothesisLabel: text("hypothesis_label").notNull(),  // "UX Designer"
    refType: text("ref_type"),                            // profession | sector | skill
    refId: text("ref_id"),                                // clusterId, es. "profession:42"

    action: text("action").notNull(),                    // micro-esperimento concreto
    killCriterion: text("kill_criterion").notNull(),      // criterio di stop deciso PRIMA

    startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
    reviewDate: timestamp("review_date", { withTimezone: true }).notNull(),

    status: text("status", { enum: CAREER_SPIKE_STATUSES }).notNull().default("active"),
    outcome: jsonb("outcome").$type<CareerSpikeOutcome>(),

    // collegamenti soft alle strutture esistenti (no FK rigida: riuso, non accoppiamento)
    objectiveId: integer("objective_id"),
    calendarEventId: integer("calendar_event_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("career_spikes_user_idx").on(t.userId),
    statusIdx: index("career_spikes_status_idx").on(t.status),
  }),
);

export type CareerSpike    = typeof careerSpikesTable.$inferSelect;
export type NewCareerSpike = typeof careerSpikesTable.$inferInsert;
