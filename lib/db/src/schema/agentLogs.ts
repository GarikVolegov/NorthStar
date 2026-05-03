import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const agentLogsTable = pgTable("agent_logs", {
  id: serial("id").primaryKey(),
  agentName: text("agent_name").notNull(),
  userId: integer("user_id"),
  taskType: text("task_type").notNull(),
  inputSummary: jsonb("input_summary"),
  outputSummary: jsonb("output_summary"),
  durationMs: integer("duration_ms"),
  error: text("error"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentLog = typeof agentLogsTable.$inferSelect;
export type InsertAgentLog = typeof agentLogsTable.$inferInsert;
