/**
 * user_motivational_profile
 *
 * Profilo motivazionale dell'utente basato su tre framework validati:
 *
 * 1. Self-Determination Theory (SDT) — Deci & Ryan
 *    Tre bisogni psicologici di base che predicono motivazione intrinseca:
 *    - Autonomy    → bisogno di controllo e scelta
 *    - Competence  → bisogno di efficacia e maestria
 *    - Relatedness → bisogno di connessione significativa
 *
 * 2. McClelland's Needs Theory
 *    - Achievement → eccellenza, completamento obiettivi
 *    - Affiliation → connessione sociale, relazioni
 *    - Power       → influenza, impatto, controllo
 *
 * 3. Schwartz Values Framework (10 dimensioni)
 *    Valori fondamentali che guidano le scelte di vita e carriera.
 *    primaryValues (JSONB) contiene le top 3 dimensioni ranked.
 *
 * Tutti gli score sono float 0-1 (normalizzati dalla somma).
 * Privacy: cascade delete su user delete.
 */

import {
  pgTable,
  integer,
  real,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userMotivationalProfileTable = pgTable(
  "user_motivational_profile",
  {
    /** FK verso users — 1:1, PK */
    userId: integer("user_id")
      .notNull()
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    // ── SDT Core Needs ───────────────────────────────────────────────────
    /** Bisogno di autonomia: controllo sulle proprie scelte (0-1) */
    needAutonomy: real("need_autonomy").default(0.33),
    /** Bisogno di competenza: efficacia, padronanza, crescita (0-1) */
    needCompetence: real("need_competence").default(0.33),
    /** Bisogno di relazioni: appartenenza, connessione (0-1) */
    needRelatedness: real("need_relatedness").default(0.33),

    // ── McClelland ───────────────────────────────────────────────────────
    /** Bisogno di achievement: eccellenza, completamento tasks (0-1) */
    needAchievement: real("need_achievement").default(0.33),
    /** Bisogno di affiliazione: connessione, lavoro di squadra (0-1) */
    needAffiliation: real("need_affiliation").default(0.33),
    /** Bisogno di potere: influenza, leadership, impatto (0-1) */
    needPower: real("need_power").default(0.33),

    // ── Schwartz Values (10 dimensioni) ─────────────────────────────────
    /** Curiosità, creatività, autonomia di pensiero e azione */
    valueSelfDirection: real("value_self_direction").default(0),
    /** Eccitazione, novità, sfida, rischio */
    valueStimulation: real("value_stimulation").default(0),
    /** Piacere, gratificazione personale */
    valueHedonism: real("value_hedonism").default(0),
    /** Successo personale, ambizione, competenza dimostrata */
    valueAchievement: real("value_achievement").default(0),
    /** Status sociale, controllo delle risorse, autorità */
    valuePower: real("value_power").default(0),
    /** Sicurezza, ordine, stabilità del contesto */
    valueSecurity: real("value_security").default(0),
    /** Rispetto delle regole, obbedienza, autodisciplina */
    valueConformity: real("value_conformity").default(0),
    /** Rispetto della tradizione, umiltà, moderazione */
    valueTradition: real("value_tradition").default(0),
    /** Benessere del gruppo vicino, onestà, lealtà */
    valueBenevolence: real("value_benevolence").default(0),
    /** Giustizia, uguaglianza, protezione dell'ambiente */
    valueUniversalism: real("value_universalism").default(0),

    /**
     * Top 3 valori Schwartz in ordine discendente.
     * Esempio: ["self_direction", "achievement", "benevolence"]
     */
    primaryValues: jsonb("primary_values")
      .$type<string[]>()
      .default([]),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
);

export type UserMotivationalProfile =
  typeof userMotivationalProfileTable.$inferSelect;
export type NewUserMotivationalProfile =
  typeof userMotivationalProfileTable.$inferInsert;
