/**
 * Agent review tables — single source of truth for all agent runs.
 *
 * FIXED:
 * - auditLogs.userId: text → integer (matches usersTable.id)
 * - agentRunsTable: added FK on userId (SET NULL — runs survive user deletion)
 * - agentRunsTable: added index on (agentName, startedAt) for monitoring queries
 * - agentLogsTable merged here — see agentLogs.ts for migration notes
 * - Added retryCount field (was on agentLogsTable, missing here)
 */
import {
  pgTable, serial, integer, text, timestamp, jsonb, real, index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const agentRunsTable = pgTable(
  "agent_runs",
  {
    id: serial("id").primaryKey(),
    agentName: text("agent_name").notNull(),
    // FIXED: was missing FK
    userId: integer("user_id").references(() => usersTable.id, {
      onDelete: "set null",
    }),
    taskType: text("task_type"),
    inputSummary: text("input_summary"),
    outputSummary: text("output_summary"),
    status: text("status", {
      enum: ["running", "completed", "failed", "cancelled"],
    })
      .notNull()
      .default("completed"),
    retryCount: integer("retry_count").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Monitoring: recent runs per agent name
    agentStartedIdx: index("agent_runs_agent_started_idx").on(
      t.agentName,
      t.startedAt,
    ),
    // Filter by user
    userIdx: index("agent_runs_user_idx").on(t.userId),
  }),
);

export const agentSuggestionsTable = pgTable("agent_suggestions", {
  id: serial("id").primaryKey(),
  agentRunId: integer("agent_run_id").references(() => agentRunsTable.id, {
    onDelete: "set null",
  }),
  entityType: text("entity_type").notNull(),
  entityName: text("entity_name").notNull(),
  payloadJson: jsonb("payload_json").$type<Record<string, unknown>>(),
  confidenceScore: real("confidence_score"),
  status: text("status", {
    enum: ["pending_review", "approved", "rejected", "applied"],
  })
    .notNull()
    .default("pending_review"),
  reviewedBy: text("reviewed_by"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const reviewQueueTable = pgTable("review_queue", {
  id: serial("id").primaryKey(),
  suggestionId: integer("suggestion_id")
    .notNull()
    .references(() => agentSuggestionsTable.id, { onDelete: "cascade" }),
  queueStatus: text("queue_status", {
    enum: ["pending_review", "in_review", "done"],
  })
    .notNull()
    .default("pending_review"),
  priority: text("priority", { enum: ["low", "normal", "high", "urgent"] })
    .notNull()
    .default("normal"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * @deprecated Usa auditLogTable da "./auditLog" con category="agent_action".
 * Questa tabella (audit_logs) è stata sostituita da audit_log unificato.
 * Migration: INSERT INTO audit_log (actor_id, action, category, metadata)
 *   SELECT user_id, action, 'agent_action', jsonb_build_object('targetType', target_type, 'targetId', target_id, 'metadata', metadata_json)
 *   FROM audit_logs;
 * Poi: DROP TABLE audit_logs;
 */
export const auditLogsTable = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: integer("target_id"),
  metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type AgentRun = typeof agentRunsTable.$inferSelect;
export type InsertAgentRun = typeof agentRunsTable.$inferInsert;
export type AgentSuggestion = typeof agentSuggestionsTable.$inferSelect;
export type InsertAgentSuggestion = typeof agentSuggestionsTable.$inferInsert;
export type ReviewQueueItem = typeof reviewQueueTable.$inferSelect;
export type InsertReviewQueueItem = typeof reviewQueueTable.$inferInsert;
// AuditLog types moved to auditLog.ts (canonical source).
// import { AuditLog, InsertAuditLog } from "./auditLog";
