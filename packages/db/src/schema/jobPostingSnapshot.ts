/**
 * job_posting_snapshots — aggregati mensili di job posting per ruolo.
 *
 * NON archivia singoli annunci (che conterrebbero PII dei candidati
 * o dati proprietari). Solo aggregati anonimi a livello role+geography+period.
 *
 * Usati per: trend_score, skill_cooccurrence, weak_signal detection.
 *
 * PRIVACY: nessun PII — solo aggregati statistici.
 */
import {
  pgTable, serial, text, integer, real, timestamp, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sectorsTable } from "./sectors";
import { professionsTable } from "./professions";

export const jobPostingSnapshotsTable = pgTable(
  "job_posting_snapshots",
  {
    id:          serial("id").primaryKey(),
    roleTitle:   text("role_title").notNull(),              // titolo normalizzato (lowercase)
    sectorId:    integer("sector_id")
                   .references(() => sectorsTable.id, { onDelete: "set null" }),
    professionId: integer("profession_id")
                   .references(() => professionsTable.id, { onDelete: "set null" }),

    count:        integer("count").notNull(),               // n. annunci nel periodo
    period:       text("period").notNull(),                 // 'YYYY-MM'
    geography:    text("geography").notNull(),              // 'IT' | 'EU' | 'US' | 'Global'

    topSkills:    text("top_skills").array().notNull().default([]),  // top-10 skill negli annunci
    avgSalaryMin: integer("avg_salary_min"),
    avgSalaryMax: integer("avg_salary_max"),
    growthRate:   real("growth_rate"),                      // % vs periodo precedente

    source:       text("source").notNull(),                 // 'lightcast' | 'indeed_feed' | 'infojobs_feed'
    createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueSnapshot: uniqueIndex("job_posting_snapshots_unique_idx")
                      .on(t.roleTitle, t.period, t.geography, t.source),
    periodGeoIdx:   index("job_posting_snapshots_period_geo_idx").on(t.period, t.geography),
    roleTitleIdx:   index("job_posting_snapshots_role_title_idx").on(t.roleTitle),
    professionIdx:  index("job_posting_snapshots_profession_idx").on(t.professionId),
    sectorIdx:      index("job_posting_snapshots_sector_idx").on(t.sectorId),
  }),
);

export type JobPostingSnapshot    = typeof jobPostingSnapshotsTable.$inferSelect;
export type NewJobPostingSnapshot = typeof jobPostingSnapshotsTable.$inferInsert;
