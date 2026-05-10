/**
 * Added FK on userId. messages now typed with role enum.
 */
import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const coachSessionsTable = pgTable("coach_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Nuova sessione"),
  messages: jsonb("messages")
    .$type<Array<{ role: "user" | "assistant" | "system"; content: string; createdAt: string }>>()
    .notNull()
    .default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CoachSession = typeof coachSessionsTable.$inferSelect;
