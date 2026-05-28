/**
 * commitment_readiness — punteggio 0-100 che misura quanto un utente "indeciso"
 * è pronto a passare da esplorazione a scelta concreta.
 *
 * Una riga per utente (PK = userId). Aggiornata dal Discovery Engine ogni volta
 * che viene registrato un nuovo `user_discovery_signal`.
 *
 * BANDE COMPORTAMENTALI:
 *   <30  → UI minimale, una sola CTA ("prova questo")
 *   30-70→ 3 strumenti scelti dinamicamente
 *   >70  → Wendy propone transizione di journey
 *
 * PRIVACY: cascade su user delete.
 */
import { pgTable, integer, real, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const commitmentReadinessTable = pgTable(
  "commitment_readiness",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** Score 0-100. */
    score: real("score").notNull().default(0),

    /**
     * Componenti dello score (somma ≤ score totale):
     *   {
     *     selfKnowledge: 0-25,   // test/Career DNA completati
     *     exploration:   0-25,   // reazioni settori, shadow-day, test-drive
     *     reflection:    0-25,   // diary entries indizi + coach socratic steps
     *     emotion:       0-15,   // mood checkin frequency
     *     commitment:    0-10,   // ha pianificato azioni
     *   }
     */
    components: jsonb("components")
      .$type<{
        selfKnowledge: number;
        exploration: number;
        reflection: number;
        emotion: number;
        commitment: number;
      }>()
      .notNull()
      .default({ selfKnowledge: 0, exploration: 0, reflection: 0, emotion: 0, commitment: 0 }),

    /** Suggerimento testuale corrente (gap dominante). Es. "Prova un check-in mood". */
    nextNudge: jsonb("next_nudge")
      .$type<{ component: string; toolHref: string; message: string }>(),

    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId] }),
  }),
);

export type CommitmentReadiness = typeof commitmentReadinessTable.$inferSelect;
export type NewCommitmentReadiness = typeof commitmentReadinessTable.$inferInsert;
