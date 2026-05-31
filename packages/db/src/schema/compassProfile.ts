/**
 * compass_profiles — "La Bussola" dell'utente indeciso.
 *
 * Vista materializzata (1 riga per utente) del profilo direzionale, ricomputata
 * da `recomputeCompass()` fondendo: compass_signals (capture-tool nuovi) +
 * adapter sulle fonti esistenti (test_sessions, simulated_days, diary indizi,
 * skill_bridge). NON sostituisce quei sistemi: li orchestra.
 *
 * PRIVACY: dato personale sensibile (blocco, energia). Sempre owner-scoped,
 * cascade on user delete, incluso nello sweep GDPR.
 */
import {
  pgTable, integer, text, jsonb, real, timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const COMPASS_BLOCK_TYPES = [
  "too_many_interests",   // scanner / multipotenziale
  "no_interests",         // niente accende
  "fear_economic",        // paura di non guadagnare
  "external_pressure",    // aspettative altrui
  "fear_mediocrity",      // paura di essere mediocre
  "unknown",
] as const;
export type CompassBlockType = typeof COMPASS_BLOCK_TYPES[number];

export const COMPASS_STAGES = [
  "zero_ideas",      // nessuna direzione
  "hypotheses",      // 1-3 ipotesi emerse
  "experimenting",   // spike attivo
  "committed",       // direzione confermata da esperienza
] as const;
export type CompassStage = typeof COMPASS_STAGES[number];

export interface CompassHypothesis {
  clusterId:  string;        // es. "profession:42" | "sector:7"
  label:      string;        // "UX Designer"
  confidence: number;        // 0..1
  source:     string[];      // ["specchio","try_a_day","torneo"]
  testedAt?:  string | null; // ISO — settato quando uno spike la testa
  verdict?:   "open" | "confirmed" | "discarded";
}

export const compassProfilesTable = pgTable("compass_profiles", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  blockType: text("block_type", { enum: COMPASS_BLOCK_TYPES }).notNull().default("unknown"),

  // RIASEC "rivelato" dal comportamento (≠ dichiarato del test)
  revealedRiasec: jsonb("revealed_riasec").$type<Record<string, number>>().notNull().default({}),

  // Aggregati energia: { energizers: string[], drainers: string[], dims: {...} }
  energyProfile: jsonb("energy_profile").$type<Record<string, unknown>>().notNull().default({}),

  hypotheses: jsonb("hypotheses").$type<CompassHypothesis[]>().notNull().default([]),

  stage: text("stage", { enum: COMPASS_STAGES }).notNull().default("zero_ideas"),

  signalCount: integer("signal_count").notNull().default(0),

  // confidenza globale 0..1 nel fatto che l'utente abbia trovato una direzione
  directionConfidence: real("direction_confidence").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CompassProfile    = typeof compassProfilesTable.$inferSelect;
export type NewCompassProfile = typeof compassProfilesTable.$inferInsert;
