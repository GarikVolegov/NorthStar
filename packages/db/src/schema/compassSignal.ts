/**
 * compass_signals — stream append-only di micro-segnali della Bussola.
 *
 * SOLO per i capture-tool NUOVI (Specchio, Torneo, Spike, Diagnostico blocco).
 * Le fonti esistenti (test_sessions, simulated_days, diary indizi, skill_bridge)
 * NON vengono duplicate qui: `recomputeCompass()` le legge direttamente via adapter.
 *
 * Mai cancellato (la storia = onestà del profilo). Owner-scoped, cascade on delete.
 */
import {
  pgTable, serial, integer, text, jsonb, real, timestamp, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const COMPASS_SIGNAL_TYPES = [
  "scene_swipe",        // Lo Specchio
  "tournament_choice",  // Il Torneo
  "block_answer",       // Diagnostico del blocco
  "spike_outcome",      // Career Spike (continue/kill)
  "chat_reaction",      // Wendy: reazione emersa in chat (con conferma)
] as const;
export type CompassSignalType = typeof COMPASS_SIGNAL_TYPES[number];

export interface CompassSignalPayload {
  valence?:    number;                 // -1 (spento) .. 1 (acceso)
  energy?:     number;                 // -1 .. 1
  reactionMs?: number;                 // esitazione = segnale
  dims?:       Record<string, number>; // contributo RIASEC { R,I,A,S,E,C }
  [k: string]: unknown;
}

export const compassSignalsTable = pgTable(
  "compass_signals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    signalType: text("signal_type", { enum: COMPASS_SIGNAL_TYPES }).notNull(),

    // riferimento opzionale all'entità toccata
    refType: text("ref_type"),   // "profession" | "sector" | "skill" | "scene"
    refId:   text("ref_id"),

    payload: jsonb("payload").$type<CompassSignalPayload>().notNull().default({}),

    // peso recency/confidence applicato in fase di fusione
    weight: real("weight").notNull().default(1),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("compass_signals_user_idx").on(t.userId),
    typeIdx: index("compass_signals_type_idx").on(t.signalType),
    userCreatedIdx: index("compass_signals_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type CompassSignal    = typeof compassSignalsTable.$inferSelect;
export type NewCompassSignal = typeof compassSignalsTable.$inferInsert;
