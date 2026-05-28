/**
 * Added FK on userId. messages now typed with role enum.
 */
import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Mode della sessione coach.
 *   - free:     chat libera (default storico)
 *   - socratic: protocollo "indeciso" a 4 step
 *                 (mappa_rumore → fear_setting → ten_ten_ten → regret_min → carta_bivio)
 *   - plateau:  protocollo "dipendente" stuck (future ondate)
 *   - exit:     protocollo decisione exit (future ondate)
 */
export const COACH_SESSION_MODES = ["free", "socratic", "plateau", "exit"] as const;
export type CoachSessionMode = typeof COACH_SESSION_MODES[number];

export const coachSessionsTable = pgTable("coach_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("Nuova sessione"),
  mode: text("mode", { enum: COACH_SESSION_MODES }).notNull().default("free"),
  /** Step corrente del protocollo (per modes strutturati). null se free. */
  protocolStep: text("protocol_step"),
  messages: jsonb("messages")
    .$type<Array<{ role: "user" | "assistant" | "system"; content: string; createdAt: string }>>()
    .notNull()
    .default([]),
  /** Metadata del protocollo (es. risposte chiave step-by-step, esito finale). */
  protocolState: jsonb("protocol_state").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type CoachSession = typeof coachSessionsTable.$inferSelect;
