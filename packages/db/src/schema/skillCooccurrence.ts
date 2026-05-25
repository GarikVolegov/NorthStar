/**
 * skill_cooccurrences — coppie di skill che compaiono insieme spesso.
 *
 * Aggregato da job_posting_snapshots. Alimenta:
 *   - tool get_skill_cooccurrences
 *   - weak signal detection (coppie anomale insolite)
 *   - suggerimenti "skill complementari" nella UI
 *
 * PRIVACY: nessun PII — aggregati statistici su annunci di lavoro.
 */
import {
  pgTable, serial, text, integer, real, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { professionsTable } from "./professions";

export const skillCooccurrencesTable = pgTable(
  "skill_cooccurrences",
  {
    id:             serial("id").primaryKey(),

    // Skill principale (nome normalizzato, no FK per flessibilità con skill emergenti)
    skillName:      text("skill_name").notNull(),
    coSkillName:    text("co_skill_name").notNull(),

    frequency:      integer("frequency").notNull(),         // n. co-occorrenze nel periodo
    frequencyRate:  real("frequency_rate").notNull(),       // % annunci dove appaiono insieme

    // Contesto ruolo opzionale (se cooccorrenza è specifica per un ruolo)
    professionId:   integer("profession_id")
                      .references(() => professionsTable.id, { onDelete: "set null" }),

    period:         text("period").notNull(),               // 'YYYY-MM'
    source:         text("source").notNull(),
    createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniquePair: uniqueIndex("skill_cooccurrences_unique_idx")
                  .on(t.skillName, t.coSkillName, t.period, t.professionId),
    skillIdx:   index("skill_cooccurrences_skill_idx").on(t.skillName),
    coSkillIdx: index("skill_cooccurrences_coskill_idx").on(t.coSkillName),
    periodIdx:  index("skill_cooccurrences_period_idx").on(t.period),
  }),
);

export type SkillCooccurrence    = typeof skillCooccurrencesTable.$inferSelect;
export type NewSkillCooccurrence = typeof skillCooccurrencesTable.$inferInsert;
