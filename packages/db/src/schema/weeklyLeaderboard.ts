import { pgTable, serial, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";

export const weeklyLeaderboardTable = pgTable(
  "weekly_leaderboard",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
    weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
    xpEarned: integer("xp_earned").notNull().default(0),
    sessionsCompleted: integer("sessions_completed").notNull().default(0),
    rank: integer("rank"),
    prizeAwarded: boolean("prize_awarded").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    weekUserIdx: index("weekly_lb_week_user_idx").on(t.weekStart, t.userId),
  }),
);

export type WeeklyLeaderboardEntry = typeof weeklyLeaderboardTable.$inferSelect;
export type InsertWeeklyLeaderboardEntry = typeof weeklyLeaderboardTable.$inferInsert;

export const weeklyLeaderboardRelations = relations(weeklyLeaderboardTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [weeklyLeaderboardTable.userId],
    references: [usersTable.id],
  }),
}));
