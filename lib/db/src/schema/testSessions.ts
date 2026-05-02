import { pgTable, serial, timestamp, integer, real, json, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const testSessionsTable = pgTable("test_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  answers: json("answers").$type<Record<string, number>>().notNull().default({}),
  riasecScores: json("riasec_scores").$type<Record<string, number>>().notNull().default({}),
  primaryTypes: json("primary_types").$type<string[]>().notNull().default([]),
  profileSummary: text("profile_summary").notNull().default(""),
  recommendations: json("recommendations").$type<Array<{
    sectorId: number;
    sectorName: string;
    matchScore: number;
    matchReason: string;
  }>>().notNull().default([]),
  spiritScores: json("spirit_scores").$type<Record<string, number>>().notNull().default({}),
  dominantSpirit: text("dominant_spirit").notNull().default(""),
  confirmedSectorId: integer("confirmed_sector_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTestSessionSchema = createInsertSchema(testSessionsTable).omit({ id: true, createdAt: true });
export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;
export type TestSession = typeof testSessionsTable.$inferSelect;
