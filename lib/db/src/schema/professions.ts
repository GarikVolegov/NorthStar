import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const professionsTable = pgTable("professions", {
  id:            serial("id").primaryKey(),
  title:         text("title").notNull(),
  sector:        text("sector").notNull(),
  riasecFit:     text("riasec_fit").array().notNull().default(sql`'{}'::text[]`),
  skills:        text("skills").array().notNull().default(sql`'{}'::text[]`),
  workModes:     text("work_modes").array().notNull().default(sql`'{}'::text[]`),
  salaryRange:   text("salary_range").notNull(),
  growthOutlook: text("growth_outlook").notNull(),
  isActive:      boolean("is_active").notNull().default(true),
  createdAt:     timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Profession = typeof professionsTable.$inferSelect;
export type NewProfession = typeof professionsTable.$inferInsert;
