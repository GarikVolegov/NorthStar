/**
 * user_psychological_profile
 *
 * Profilo psicologico scientifico dell'utente basato su:
 * - Big Five / OCEAN (Ten-Item Personality Inventory + inferenza NLP)
 * - Stile decisionale (analitico / direttivo / intuitivo / collaborativo)
 * - Tolleranza al rischio
 * - Stile di comunicazione preferito
 * - Cronotype (mattutino / intermedio / serale) con confidence
 *
 * I valori possono derivare da:
 * - "explicit"  → quiz TIPI completato dall'utente
 * - "inferred"  → motore di inferenza passiva (NLP conversazioni + usage pattern)
 * - "hybrid"    → combinazione pesata dei due
 *
 * Wendy usa questi dati (se confidence >= 0.5) per adattare tono,
 * stile e tipo di suggerimenti in modo individuale.
 *
 * Privacy: cascade delete su user delete; soft-delete via userProfilingConsents.
 */

import {
  pgTable,
  integer,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userPsychologicalProfileTable = pgTable(
  "user_psychological_profile",
  {
    /** FK verso users — 1:1, PK */
    userId: integer("user_id")
      .notNull()
      .primaryKey()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    // ── Big Five (OCEAN) ─────────────────────────────────────────────────
    /** Openness to Experience: curiosità, creatività, apertura intellettuale (0-1) */
    oceanOpenness: real("ocean_openness"),
    /** Conscientiousness: organizzazione, disciplina, affidabilità (0-1) */
    oceanConscientiousness: real("ocean_conscientiousness"),
    /** Extraversion: energia sociale, assertività, loquacità (0-1) */
    oceanExtraversion: real("ocean_extraversion"),
    /** Agreeableness: cooperazione, empatia, compassione (0-1) */
    oceanAgreeableness: real("ocean_agreeableness"),
    /** Neuroticism: reattività emotiva, ansia, instabilità (0-1) */
    oceanNeuroticism: real("ocean_neuroticism"),

    /** Come sono stati derivati i valori OCEAN */
    oceanSource: text("ocean_source", {
      enum: ["explicit", "inferred", "hybrid"],
    }),
    /** Confidenza media degli score OCEAN (0-1); < 0.5 → Wendy non usa */
    oceanConfidence: real("ocean_confidence").default(0),

    // ── Stile decisionale ────────────────────────────────────────────────
    /**
     * analytical   → dati, logica, analisi approfondita
     * directive    → rapido, efficiente, regole chiare
     * intuitive    → visione d'insieme, pattern, sensazioni
     * collaborative → consensus, relazioni, impatto sulle persone
     */
    decisionStyle: text("decision_style", {
      enum: ["analytical", "directive", "intuitive", "collaborative"],
    }),

    // ── Tolleranza al rischio ────────────────────────────────────────────
    riskTolerance: text("risk_tolerance", {
      enum: ["conservative", "moderate", "bold"],
    }),

    // ── Stile di comunicazione ───────────────────────────────────────────
    /**
     * concise   → risposte brevi, bullet points, sintesi
     * detailed  → spiegazioni approfondite, esempi, contesto
     * visual    → metafore, analogie, schemi descrittivi
     * narrative → storytelling, esempi concreti, casi reali
     */
    communicationStyle: text("communication_style", {
      enum: ["concise", "detailed", "visual", "narrative"],
    }),

    // ── Cronotype ────────────────────────────────────────────────────────
    /**
     * morning      → picco cognitivo 6-12
     * intermediate → picco cognitivo 10-16
     * evening      → picco cognitivo 17-23
     * Richiede min 10 sessioni per confidence affidabile.
     */
    chronotype: text("chronotype", {
      enum: ["morning", "intermediate", "evening"],
    }),
    /** Confidenza del cronotype (0-1); basata su N sessioni analizzate */
    chronotypeConfidence: real("chronotype_confidence").default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
);

export type UserPsychologicalProfile =
  typeof userPsychologicalProfileTable.$inferSelect;
export type NewUserPsychologicalProfile =
  typeof userPsychologicalProfileTable.$inferInsert;
