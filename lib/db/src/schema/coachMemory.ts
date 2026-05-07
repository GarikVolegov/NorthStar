/**
 * Coach Memory Tables
 *
 * TWO MEMORY TYPES — aligned with what the user selected (option C):
 *
 * 1. coach_memory_facts  — BIOGRAPHICAL MEMORY
 *    Concrete facts about the user extracted from conversations:
 *    name, age, job, city, relationship status, current projects,
 *    declared goals, constraints. Each fact has a key (unique per user)
 *    so updates overwrite instead of duplicate.
 *
 *    Examples:
 *      { key: "job",        value: "lavoro in una startup fintech" }
 *      { key: "age",        value: "24 anni" }
 *      { key: "goal_main",  value: "uscire dal lavoro dipendente entro 1 anno" }
 *      { key: "city",       value: "Milano" }
 *
 * 2. coach_memory_patterns — SEMANTIC / BEHAVIORAL MEMORY
 *    Recurring patterns observed across multiple sessions.
 *    Each entry has a patternType, a description, and a confidence score
 *    that increases every time the same pattern is observed again.
 *
 *    patternType values:
 *      limiting_belief   — e.g. "tende a pensare che le sue idee non siano abbastanza buone"
 *      strength          — e.g. "forte capacità analitica, usa i dati per decidere"
 *      recurring_theme   — e.g. "torna spesso sul tema del tempo libero vs ambizione"
 *      emotional_trigger — e.g. "si blocca quando percepisce giudizio esterno"
 *      growth_edge       — e.g. "sta imparando a delegare, ma fatica con il controllo"
 */
import {
  pgTable, serial, integer, text, varchar,
  timestamp, real, uniqueIndex, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

// ── Table 1: Biographical facts ──────────────────────────────────────────────
export const coachMemoryFactsTable = pgTable(
  "coach_memory_facts",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    /** Unique key per user — upsert overwrites, no duplicates */
    key: varchar("key", { length: 64 }).notNull(),
    /** Human-readable value extracted from the conversation */
    value: text("value").notNull(),
    /** Source session ID where this fact was first extracted */
    sourceSessionId: integer("source_session_id"),
    /** How many times this fact has been confirmed / updated */
    confirmedCount: integer("confirmed_count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userKeyUnique: uniqueIndex("coach_memory_facts_user_key").on(t.userId, t.key),
    userIdx: index("coach_memory_facts_user_idx").on(t.userId),
  }),
);

// ── Table 2: Behavioral / semantic patterns ───────────────────────────────────
export const coachMemoryPatternsTable = pgTable(
  "coach_memory_patterns",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    patternType: varchar("pattern_type", { length: 32 }).notNull(),
    /** Natural language description of the pattern */
    description: text("description").notNull(),
    /** 0-1 confidence based on how many times observed */
    confidence: real("confidence").notNull().default(0.5),
    /** Number of sessions where this pattern was observed */
    observedCount: integer("observed_count").notNull().default(1),
    /** Session IDs where this pattern appeared (for traceability) */
    sessionIds: integer("session_ids").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("coach_memory_patterns_user_idx").on(t.userId),
    typeIdx: index("coach_memory_patterns_type_idx").on(t.patternType),
  }),
);

export type CoachMemoryFact    = typeof coachMemoryFactsTable.$inferSelect;
export type CoachMemoryPattern = typeof coachMemoryPatternsTable.$inferSelect;
