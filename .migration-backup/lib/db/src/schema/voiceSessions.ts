import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { usersTable } from "./users";

/**
 * voice_sessions — Phase 3: Gamification Base
 *
 * Tracks every AI voice coaching session. Each completed session:
 *  1. Awards XP to the user (xpAwarded)
 *  2. May extend the voiceStreak on the users table
 *  3. Records duration and a short summary for coach memory
 */
export const voiceSessionsTable = pgTable(
  "voice_sessions",
  {
    id: serial("id").primaryKey(),

    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    /** Session state: ongoing | completed | abandoned */
    status: text("status", {
      enum: ["ongoing", "completed", "abandoned"],
    })
      .notNull()
      .default("ongoing"),

    /** Duration of the session in seconds */
    durationSeconds: integer("duration_seconds"),

    /** XP awarded at the end of this session */
    xpAwarded: integer("xp_awarded").notNull().default(0),

    /** Whether this session counted toward the voiceStreak */
    countedForStreak: boolean("counted_for_streak").notNull().default(false),

    /** Short AI-generated summary of the session topics */
    summary: text("summary"),

    /** The NorthStar agent that ran the session (e.g. 'orientamento', 'coaching') */
    agentType: text("agent_type"),

    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => ({
    userIdx: index("voice_sessions_user_idx").on(t.userId),
    userStatusIdx: index("voice_sessions_user_status_idx").on(t.userId, t.status),
    startedAtIdx: index("voice_sessions_started_at_idx").on(t.startedAt),
  }),
);

export type VoiceSession = typeof voiceSessionsTable.$inferSelect;
export type InsertVoiceSession = typeof voiceSessionsTable.$inferInsert;

export const voiceSessionsRelations = relations(voiceSessionsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [voiceSessionsTable.userId],
    references: [usersTable.id],
  }),
}));
