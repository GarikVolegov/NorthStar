/**
 * user_behavioral_signals
 *
 * Segnali comportamentali passivi aggregati a livello settimanale.
 * Non contiene MAI testo grezzo o PII — solo metriche numeriche aggregate.
 *
 * Scopo: alimentare il motore di inferenza del profilo psicologico
 * senza richiedere azioni esplicite dall'utente (privacy-by-design).
 *
 * Il job settimanale (profile-inference-job) popola questa tabella
 * analizzando: ai_request_log, coach_sessions, voice_sessions, user_objectives.
 *
 * Segnali linguistici derivati dal testo (LIWC-proxy, italiano):
 * - questionVsStatement: ratio domande/affermazioni → curiosità (Openness)
 * - negativeEmotionWords: % "preoccupato", "stressato", "paura" → Neuroticism
 * - uncertaintyMarkers: "forse", "non so", "magari" → Neuroticism / indecisione
 * - socialWordUsage: "noi", "team", "colleghi" → Agreeableness / Extraversion
 * - futureTemporalFocus: "vorrei", "farò", "domani" → Conscientiousness
 *
 * Privacy: PK composita (userId, weekStart); cascade delete su user delete.
 * Retention: mantenere max 52 settimane per utente (1 anno rolling window).
 */

import {
  pgTable,
  integer,
  real,
  date,
  jsonb,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userBehavioralSignalsTable = pgTable(
  "user_behavioral_signals",
  {
    /** FK verso users */
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /**
     * Inizio della settimana ISO (lunedì) — es. "2025-05-26"
     * Compound PK con userId: una riga per utente per settimana.
     */
    weekStart: date("week_start").notNull(),

    // ── Segnali temporali / cronobiologici ───────────────────────────────
    /** Ora inizio del picco di attività (0-23) */
    peakHourStart: integer("peak_hour_start"),
    /** Ora fine del picco di attività (0-23) */
    peakHourEnd: integer("peak_hour_end"),
    /** Latenza media in ms tra inizio sessione e primo messaggio Wendy */
    avgResponseLatencyMs: integer("avg_response_latency_ms"),
    /** Durata media delle sessioni in minuti */
    avgSessionMinutes: real("avg_session_minutes"),

    // ── Segnali di engagement ────────────────────────────────────────────
    /**
     * Top domini di query con profondità media.
     * Struttura: [{ domain: "career", queryCount: 12, avgDepth: 0.8 }]
     * domain: career | mindset | habits | learning | social | market
     * avgDepth: 0-1 (0=superficiale, 1=conversazione lunga/approfondita)
     */
    topDomains: jsonb("top_domains")
      .$type<Array<{ domain: string; queryCount: number; avgDepth: number }>>()
      .default([]),

    /** Regolarità dello streak (0=nessuno streak, 1=streak perfetto) */
    streakConsistency: real("streak_consistency").default(0),
    /** Tasso di completamento obiettivi nella settimana (0-1) */
    goalCompletionRate: real("goal_completion_rate").default(0),
    /**
     * Ratio esplora/approfondisce: alto → temperamento esplorativo (Openness ↑)
     * calcolato come: (N sessioni con ≥3 topic diversi) / (N sessioni totali)
     */
    exploreVsFocusRatio: real("explore_vs_focus_ratio").default(0.5),

    // ── Segnali linguistici (LIWC-proxy italiano) ────────────────────────
    /**
     * Ratio domande / (domande + affermazioni) nel testo utente.
     * Proxy per curiosità e Openness. Range: 0-1.
     */
    questionVsStatement: real("question_vs_statement").default(0),
    /**
     * % parole a valenza emotiva negativa sul totale parole.
     * Proxy per Neuroticism. Range: 0-1.
     * Dizionario: "preoccupato", "stressato", "paura", "ansia", "difficile", ecc.
     */
    negativeEmotionWords: real("negative_emotion_words").default(0),
    /**
     * % marker di incertezza sul totale frasi.
     * Proxy per Neuroticism / indecisione. Range: 0-1.
     * Dizionario: "forse", "non so", "magari", "credo", "probabilmente", ecc.
     */
    uncertaintyMarkers: real("uncertainty_markers").default(0),
    /**
     * % parole sociali sul totale parole.
     * Proxy per Agreeableness / Extraversion. Range: 0-1.
     * Dizionario: "noi", "insieme", "team", "colleghi", "amici", "condividere", ecc.
     */
    socialWordUsage: real("social_word_usage").default(0),
    /**
     * % riferimenti temporali al futuro sul totale verbi.
     * Proxy per Conscientiousness / orientamento agli obiettivi. Range: 0-1.
     * Segnali: "vorrei", "potrei", "farò", "domani", "futuro", "piano", ecc.
     */
    futureTemporalFocus: real("future_temporal_focus").default(0),

    /** Timestamp di creazione della riga (inserita dal job settimanale) */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.weekStart] }),
    userIdx: index("user_behavioral_signals_user_idx").on(t.userId),
    weekIdx: index("user_behavioral_signals_week_idx").on(t.weekStart),
  }),
);

export type UserBehavioralSignals =
  typeof userBehavioralSignalsTable.$inferSelect;
export type NewUserBehavioralSignals =
  typeof userBehavioralSignalsTable.$inferInsert;
