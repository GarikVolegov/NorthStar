import {
  pgTable,
  uuid,
  jsonb,
  timestamp,
  varchar,
  text,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';

// ── Tipi condivisi ───────────────────────────────────────────────────────────────

export type RiasecType = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';

export interface RiasecScore {
  type: RiasecType; // era string — ora narrowed a literal union
  score: number;
}

export interface Spirit {
  name: string;
  color: string;
  icon: string;
  description: string; // era assente in otherSpirits — ora coerente
  percentage: number;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

export const testResults = pgTable(
  'test_results',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // onDelete: 'cascade' — senza questo, eliminare un utente lascia righe
    // orfane con user_id NULL (o viola il FK se NOT NULL è aggiunto dopo).
    // 'set null' sarebbe alternativa per analytics storiche, ma qui
    // i risultati senza utente non hanno utilità applicativa.
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),

    // RIASEC
    riasecProfile:  varchar('riasec_profile', { length: 100 }).notNull(),
    riasecSubtitle: text('riasec_subtitle').notNull(),
    riasecScores:   jsonb('riasec_scores')
                      .notNull()
                      .$type<RiasecScore[]>(),

    // Cinque Spiriti
    dominantSpirit: jsonb('dominant_spirit')
                      .notNull()
                      .$type<Spirit>(),

    // otherSpirits usava un tipo anonimo senza description:
    // $type<Array<{ name; color; icon; percentage }>> — mancava description.
    // Ora usa lo stesso tipo Spirit per coerenza con dominantSpirit.
    otherSpirits:   jsonb('other_spirits')
                      .notNull()
                      .$type<Spirit[]>(),

    // Raw answers per analytics
    answers: jsonb('answers')
               .notNull()
               .$type<number[]>(),

    // updatedAt: necessario per re-test (l'utente rifà il test e si
    // aggiorna la riga esistente invece di creare duplicati)
    createdAt:  timestamp('created_at').defaultNow().notNull(),
    updatedAt:  timestamp('updated_at')
                  .defaultNow()
                  .notNull()
                  .$onUpdate(() => new Date()),
  },
  (table) => ([
    // Check constraint: almeno 1 risposta, max 200 (protezione da payload gonfiati)
    check(
      'answers_length_check',
      sql`jsonb_array_length(${table.answers}) BETWEEN 1 AND 200`,
    ),
    // Check constraint: riasecScores deve avere esattamente 6 elementi (R,I,A,S,E,C)
    check(
      'riasec_scores_length_check',
      sql`jsonb_array_length(${table.riasecScores}) = 6`,
    ),
  ]),
);

export type TestResult    = typeof testResults.$inferSelect;
export type NewTestResult = typeof testResults.$inferInsert;
