/**
 * user_profiling_consents
 *
 * Gestione granulare del consenso GDPR per ogni dimensione di profiling.
 * Implementa il principio di Privacy by Design: ogni tipo di profilazione
 * richiede consenso esplicito separato — non bundled con i termini di servizio.
 *
 * Dimensioni di profiling disponibili:
 * - big_five          → Big Five / OCEAN (quiz esplicito + inferenza NLP)
 * - values            → Framework Schwartz dei valori (quiz esplicito)
 * - motivation        → SDT needs + McClelland (quiz esplicito)
 * - linguistic        → Analisi linguistica NLP sulle conversazioni Wendy
 * - behavioral_passive → Segnali comportamentali passivi aggregati (usage patterns)
 * - chronotype        → Inferenza del cronotype da pattern di utilizzo orario
 *
 * Flusso:
 * 1. Utente ottiene informativa chiara per ogni dimensione
 * 2. Utente concede/nega consenso per ogni dimensione separatamente
 * 3. Motore di inferenza verifica consenso prima di elaborare dati
 * 4. Revoca → revokedAt settato + dati di quella dimensione cancellati
 *
 * GDPR Art. 7: il consenso deve essere liberamente revocabile e altrettanto
 * facile da revocare quanto da concedere.
 */

import {
  pgTable,
  integer,
  boolean,
  text,
  timestamp,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/** Dimensioni di profiling che richiedono consenso separato */
export const PROFILING_DIMENSIONS = [
  "big_five",
  "values",
  "motivation",
  "linguistic",
  "behavioral_passive",
  "chronotype",
] as const;

export type ProfilingDimension = (typeof PROFILING_DIMENSIONS)[number];

export const userProfilingConsentsTable = pgTable(
  "user_profiling_consents",
  {
    /** FK verso users */
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /**
     * Dimensione di profiling per cui si registra il consenso.
     * Compound PK con userId: una riga per utente per dimensione.
     */
    dimension: text("dimension", {
      enum: PROFILING_DIMENSIONS,
    }).notNull(),

    /** true = consenso concesso; false = consenso negato/revocato */
    granted: boolean("granted").notNull().default(false),

    /** Timestamp in cui il consenso è stato concesso */
    grantedAt: timestamp("granted_at", { withTimezone: true }),

    /**
     * Timestamp in cui il consenso è stato revocato.
     * Se non null → i dati di questa dimensione devono essere cancellati.
     * Il job di cleanup li elimina entro 30 giorni (GDPR Art. 17).
     */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.dimension] }),
    userIdx: index("user_profiling_consents_user_idx").on(t.userId),
    dimensionIdx: index("user_profiling_consents_dimension_idx").on(t.dimension),
  }),
);

export type UserProfilingConsent =
  typeof userProfilingConsentsTable.$inferSelect;
export type NewUserProfilingConsent =
  typeof userProfilingConsentsTable.$inferInsert;
