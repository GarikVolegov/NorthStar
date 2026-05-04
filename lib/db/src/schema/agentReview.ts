import {
  pgTable, serial, integer, text, timestamp, jsonb, real,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const agentRunsTable = pgTable("agent_runs", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  inputSummary: text("input_summary"),
  outputSummary: text("output_summary"),
  status: text("status").notNull().default("completed"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agentSuggestionsTable = pgTable("agent_suggestions", {
  id: serial("id").primaryKey(),
  agentRunId: integer("agent_run_id").references(() => agentRunsTable.id, { onDelete: "set null" }),
  entityType: text("entity_type").notNull(),
  entityName: text("entity_name").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  confidenceScore: real("confidence_score"),
  status: text("status").notNull().default("pending_review"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const reviewQueueTable = pgTable("review_queue", {
  id: serial("id").primaryKey(),
  suggestionId: integer("suggestion_id").notNull().references(() => agentSuggestionsTable.id, { onDelete: "cascade" }),
  queueStatus: text("queue_status").notNull().default("pending_review"),
  priority: text("priority").notNull().default("normal"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentRun = typeof agentRunsTable.$inferSelect;
export type InsertAgentRun = typeof agentRunsTable.$inferInsert;
export type AgentSuggestion = typeof agentSuggestionsTable.$inferSelect;
export type InsertAgentSuggestion = typeof agentSuggestionsTable.$inferInsert;
export type ReviewQueueItem = typeof reviewQueueTable.$inferSelect;
export type InsertReviewQueueItem = typeof reviewQueueTable.$inferInsert;
export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
