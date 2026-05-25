/**
 * FIXED:
 * - Added userId FK with SET NULL on user delete (sessions can outlive their user
 *   briefly during account deletion flows, but are cleaned up by a scheduled job)
 * - Converted json → jsonb for all array/object columns (indexable, faster)
 * - Added index on userId for fast per-user queries
 */
import {
  pgTable, serial, timestamp, integer, jsonb, text, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const testSessionsTable = pgTable(
  "test_sessions",
  {
    id: serial("id").primaryKey(),
    // FIXED: was bare integer, now FK with SET NULL so sessions survive
    // account deletion cleanup grace period
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    // FIXED: json → jsonb for all structured columns
    answers: jsonb("answers")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    riasecScores: jsonb("riasec_scores")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    primaryTypes: jsonb("primary_types")
      .$type<string[]>()
      .notNull()
      .default([]),
    profileSummary: text("profile_summary").notNull().default(""),
    recommendations: jsonb("recommendations")
      .$type<
        Array<{
          sectorId: number;
          sectorName: string;
          matchScore: number;
          matchReason: string;
        }>
      >()
      .notNull()
      .default([]),
    spiritScores: jsonb("spirit_scores")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    dominantSpirit: text("dominant_spirit").notNull().default(""),
    confirmedSectorId: integer("confirmed_sector_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Fast lookup of all sessions belonging to a user
    userIdx: index("test_sessions_user_idx").on(t.userId),
  }),
);

export const insertTestSessionSchema = createInsertSchema(testSessionsTable).omit(
  { id: true, createdAt: true },
);
export type InsertTestSession = z.infer<typeof insertTestSessionSchema>;
export type TestSession = typeof testSessionsTable.$inferSelect;
