/**
 * user_discovery_signals — segnali real-time per il Discovery Engine (percorso "indeciso").
 *
 * Differente da:
 *   - weak_signals               (segnali di MERCATO aggregati, non per utente)
 *   - user_behavioral_signals    (aggregati SETTIMANALI, popolati da job batch)
 *
 * Questa tabella registra OGNI evento di scoperta dell'utente in tempo reale:
 *   - completamento test/diario/mood checkin
 *   - reazione su settore (incuriosisce / respinge / non capisco)
 *   - sessione coach socratico chiusa
 *   - shadow-day / test-drive completato (future ondate)
 *
 * Alimenta il Commitment Readiness Score (vedi commitment_readiness).
 *
 * PRIVACY: cascade delete su user delete (GDPR Art. 17).
 */
import { pgTable, serial, integer, text, real, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const DISCOVERY_SIGNAL_CATEGORIES = [
  "self_knowledge",   // test, career DNA, calibratore
  "exploration",      // sector reactions, shadow-day, test-drive
  "reflection",       // diary indizi, coach socratic sessions
  "emotion",          // mood checkin
  "commitment",       // ha scelto un'azione concreta, ha pianificato
] as const;
export type DiscoverySignalCategory = typeof DISCOVERY_SIGNAL_CATEGORIES[number];

export const DISCOVERY_SIGNAL_TYPES = [
  "test_complete",
  "sector_reaction",
  "diary_entry_indizi",
  "mood_checkin",
  "coach_socratic_step",
  "vita_parallela_reaction",
  "shadow_day_complete",
  "anti_test_complete",
  "test_drive_complete",
] as const;
export type DiscoverySignalType = typeof DISCOVERY_SIGNAL_TYPES[number];

export const userDiscoverySignalsTable = pgTable(
  "user_discovery_signals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    signalType: text("signal_type", { enum: DISCOVERY_SIGNAL_TYPES }).notNull(),
    category: text("category", { enum: DISCOVERY_SIGNAL_CATEGORIES }).notNull(),

    /** Valenza emotiva del segnale: -1 (repulsione) ↔ 1 (forte attrazione). */
    valence: real("valence").notNull().default(0),
    /** Intensità del segnale: 0 (debole) ↔ 1 (forte). */
    intensity: real("intensity").notNull().default(0.5),

    /** Target opzionale del segnale: sector slug, role slug, topic keyword, ecc. */
    target: text("target"),

    /** Payload arbitrario tipo-specifico (es. risposta a un prompt, slider values). */
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("user_discovery_signals_user_created_idx").on(t.userId, t.createdAt),
    userCategoryIdx: index("user_discovery_signals_user_category_idx").on(t.userId, t.category),
    userTypeIdx: index("user_discovery_signals_user_type_idx").on(t.userId, t.signalType),
  }),
);

export type UserDiscoverySignal = typeof userDiscoverySignalsTable.$inferSelect;
export type NewUserDiscoverySignal = typeof userDiscoverySignalsTable.$inferInsert;
