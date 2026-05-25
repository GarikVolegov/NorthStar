import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }).unique(),
  personaType: text("persona_type"),
  experienceLevel: text("experience_level").default("beginner"),
  cognitiveStyle: text("cognitive_style").default("exploratory"),
  topIntents: jsonb("top_intents").$type<string[]>().default([]),
  preferredUi: text("preferred_ui").default("results_list"),
  searchCount: integer("search_count").default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const searchEventsTable = pgTable("search_events", {
  id: serial("id").primaryKey(),
  sessionId: text("session_id"),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  query: text("query").notNull(),
  resultsShown: jsonb("results_shown").$type<Array<{ id: number; type: string; title: string }>>().default([]),
  resultClicked: integer("result_clicked"),
  resultType: text("result_type"),
  dwellTimeMs: integer("dwell_time_ms"),
  dismissed: integer("dismissed").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const searchEventType = typeof searchEventsTable.$inferSelect;
export type UserProfile = typeof userProfilesTable.$inferSelect;
