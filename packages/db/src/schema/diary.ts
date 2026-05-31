import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { sectorsTable } from "./sectors";
import { usersTable } from "./users";

/**
 * Tipologia di entry del diario.
 *   - free:   entry libera (default storico)
 *   - indizi: tool B3 "Diario degli Indizi" — risposta a prompt strutturato
 *             ("Quando oggi hai sentito energia o curiosità?")
 */
export const DIARY_ENTRY_TYPES = ["free", "indizi"] as const;
export type DiaryEntryType = typeof DIARY_ENTRY_TYPES[number];

export const diaryEntriesTable = pgTable(
  "diary_entries",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    mood: text("mood", { enum: ["ottimo", "bene", "neutro", "difficile", "critico"] }),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    entryType: text("entry_type", { enum: DIARY_ENTRY_TYPES }).notNull().default("free"),
    /** Per entry "indizi": prompt mostrato + campi strutturati (energia/curiosità/contesto). */
    promptPayload: jsonb("prompt_payload").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedAtIdx: index("diary_entries_user_created_at_idx").on(t.userId, t.createdAt),
    userTypeIdx: index("diary_entries_user_type_idx").on(t.userId, t.entryType),
  }),
);

export const diaryIdeasTable = pgTable(
  "diary_ideas",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    importance: text("importance", { enum: ["bassa", "media", "alta"] }).notNull().default("media"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    emoji: text("emoji").notNull().default("💡"),
    completed: boolean("completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedAtIdx: index("diary_ideas_user_created_at_idx").on(t.userId, t.createdAt),
    userCompletedIdx: index("diary_ideas_user_completed_idx").on(t.userId, t.completed),
  }),
);

export const investorAnalysesTable = pgTable(
  "investor_analyses",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    sectorId: integer("sector_id").references(() => sectorsTable.id, { onDelete: "set null" }),
    sectorName: text("sector_name").notNull(),
    outcome: text("outcome", { enum: ["opportunita", "rischio", "neutro"] }).notNull(),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedAtIdx: index("investor_analyses_user_created_at_idx").on(t.userId, t.createdAt),
    sectorIdx: index("investor_analyses_sector_idx").on(t.sectorId),
  }),
);

export type DiaryEntry = typeof diaryEntriesTable.$inferSelect;
export type DiaryIdea = typeof diaryIdeasTable.$inferSelect;
export type InvestorAnalysis = typeof investorAnalysesTable.$inferSelect;
