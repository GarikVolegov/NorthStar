import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const agentPromptsTable = pgTable(
  "agent_prompts",
  {
    id: serial("id").primaryKey(),
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description").notNull(),
    defaultValue: text("default_value").notNull(),
    placeholders: text("placeholders").array().notNull().default([]),
    requiredPlaceholders: text("required_placeholders").array().notNull().default([]),
    activeVersionId: integer("active_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    keyIdx: uniqueIndex("agent_prompts_key_idx").on(t.key),
    activeVersionIdx: index("agent_prompts_active_version_idx").on(t.activeVersionId),
  }),
);

export const agentPromptVersionsTable = pgTable(
  "agent_prompt_versions",
  {
    id: serial("id").primaryKey(),
    promptId: integer("prompt_id")
      .notNull()
      .references(() => agentPromptsTable.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    status: text("status", {
      enum: ["draft", "active", "archived", "rolled_back"],
    })
      .notNull()
      .default("draft"),
    value: text("value").notNull(),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    promptIdx: index("agent_prompt_versions_prompt_idx").on(t.promptId),
    promptStatusIdx: index("agent_prompt_versions_prompt_status_idx").on(t.promptId, t.status),
    promptVersionIdx: uniqueIndex("agent_prompt_versions_prompt_version_idx").on(
      t.promptId,
      t.versionNumber,
    ),
  }),
);

export type AgentPrompt = typeof agentPromptsTable.$inferSelect;
export type InsertAgentPrompt = typeof agentPromptsTable.$inferInsert;
export type AgentPromptVersion = typeof agentPromptVersionsTable.$inferSelect;
export type InsertAgentPromptVersion = typeof agentPromptVersionsTable.$inferInsert;
