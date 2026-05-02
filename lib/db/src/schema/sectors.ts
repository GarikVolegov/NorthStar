import { pgTable, text, serial, timestamp, integer, real, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const sectorsTable = pgTable("sectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  riasecTypes: json("riasec_types").$type<string[]>().notNull().default([]),
  skills: json("skills").$type<string[]>().notNull().default([]),
  avgSalaryMin: integer("avg_salary_min").notNull(),
  avgSalaryMax: integer("avg_salary_max").notNull(),
  growthRate: real("growth_rate").notNull(),
  automationRisk: text("automation_risk", { enum: ["low", "medium", "high"] }).notNull(),
  scalability: text("scalability", { enum: ["low", "medium", "high"] }).notNull(),
  trend: text("trend", { enum: ["declining", "stable", "growing", "booming"] }).notNull(),
  timeToAutonomy: text("time_to_autonomy").notNull(),
  advantages: json("advantages").$type<string[]>().notNull().default([]),
  disadvantages: json("disadvantages").$type<string[]>().notNull().default([]),
  opportunities: json("opportunities").$type<string[]>().notNull().default([]),
  icon: text("icon").notNull().default("briefcase"),
  color: text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSectorSchema = createInsertSchema(sectorsTable).omit({ id: true, createdAt: true });
export type InsertSector = z.infer<typeof insertSectorSchema>;
export type Sector = typeof sectorsTable.$inferSelect;
