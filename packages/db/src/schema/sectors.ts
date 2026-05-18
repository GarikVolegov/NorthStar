/**
 * FIXED: all `json` columns converted to `jsonb`.
 *
 * `json` stores raw text and re-parses on every read.
 * `jsonb` stores binary, supports GIN indexes, and enables
 * operators like `@>` (contains) for skills/riasecTypes filtering.
 *
 * e.g. to find all sectors with skill 'React':
 *   WHERE skills @> '["React"]'::jsonb
 */
import {
  pgTable, text, serial, timestamp, integer, real, jsonb, boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { vector } from "../custom-types";

export const sectorsTable = pgTable("sectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  embedding: vector("embedding", { dimensions: 1536 }),
  // FIXED: json → jsonb (enables GIN index, @> operator, faster reads)
  riasecTypes: jsonb("riasec_types").$type<string[]>().notNull().default([]),
  skills: jsonb("skills").$type<string[]>().notNull().default([]),
  avgSalaryMin: integer("avg_salary_min").notNull(),
  avgSalaryMax: integer("avg_salary_max").notNull(),
  growthRate: real("growth_rate").notNull(),
  automationRisk: text("automation_risk", {
    enum: ["low", "medium", "high"],
  }).notNull(),
  scalability: text("scalability", {
    enum: ["low", "medium", "high"],
  }).notNull(),
  trend: text("trend", {
    enum: ["declining", "stable", "growing", "booming"],
  }).notNull(),
  timeToAutonomy: text("time_to_autonomy").notNull(),
  advantages: jsonb("advantages").$type<string[]>().notNull().default([]),
  disadvantages: jsonb("disadvantages").$type<string[]>().notNull().default([]),
  opportunities: jsonb("opportunities").$type<string[]>().notNull().default([]),
  icon: text("icon").notNull().default("briefcase"),
  color: text("color").notNull().default("#6366f1"),
  isActive: boolean("is_active").notNull().default(true),
  workMode: jsonb("work_mode")
    .$type<Array<"dipendente" | "autonomo" | "ibrido">>()
    .default(["dipendente", "ibrido"]),
  autonomyScore: integer("autonomy_score").default(5),
  stabilityScore: integer("stability_score").default(5),
  clientAcquisitionRequired: boolean("client_acquisition_required").default(
    false,
  ),
  freelanceSteps: jsonb("freelance_steps")
    .$type<
      Array<{ step: number; title: string; description: string }>
    >()
    .default([]),
  dipendentiSteps: jsonb("dipendenti_steps")
    .$type<
      Array<{ step: number; title: string; description: string }>
    >()
    .default([]),
  remoteFriendly: boolean("remote_friendly").default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
});

export const insertSectorSchema = createInsertSchema(sectorsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertSector = z.infer<typeof insertSectorSchema>;
export type Sector = typeof sectorsTable.$inferSelect;
