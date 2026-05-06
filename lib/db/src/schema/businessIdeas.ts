import { pgTable, serial, integer, text, timestamp, jsonb, real } from "drizzle-orm/pg-core";

export const businessIdeasTable = pgTable("business_ideas", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull().default("Nuova idea"),
  ideaText: text("idea_text").notNull(),
  sector: text("sector"),
  workType: text("work_type").notNull().default("autonomous"),
  status: text("status").notNull().default("draft"),
  validationScore: real("validation_score"),
  confidenceLevel: text("confidence_level"),
  validationData: jsonb("validation_data").$type<Record<string, unknown>>(),
  incubatorData: jsonb("incubator_data").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BusinessIdea = typeof businessIdeasTable.$inferSelect;
