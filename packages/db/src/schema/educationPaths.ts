import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const educationPathsTable = pgTable("education_paths", {
  id:             serial("id").primaryKey(),
  path:           text("path").notNull(),
  type:           text("type", { enum: ["universitario", "professionale", "online", "bootcamp"] }).notNull(),
  duration:       text("duration").notNull(),
  cost:           text("cost").notNull(),
  steps:          text("steps").array().notNull().default(sql`'{}'::text[]`),
  careerOutcomes: text("career_outcomes").array().notNull().default(sql`'{}'::text[]`),
  sectorFit:      text("sector_fit").array().notNull().default(sql`'{}'::text[]`),
  isActive:       boolean("is_active").notNull().default(true),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EducationPath = typeof educationPathsTable.$inferSelect;
export type NewEducationPath = typeof educationPathsTable.$inferInsert;
