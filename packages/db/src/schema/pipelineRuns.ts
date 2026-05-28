import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const pipelineRunsTable = pgTable(
  "pipeline_runs",
  {
    id: serial("id").primaryKey(),
    templateId: text("template_id").notNull(),
    title: text("title").notNull(),
    status: text("status", {
      enum: ["queued", "running", "blocked", "completed", "failed", "cancelled"],
    }).notNull().default("queued"),
    requestedBy: integer("requested_by").references(() => usersTable.id, { onDelete: "set null" }),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>().notNull().default({}),
    outputJson: jsonb("output_json").$type<Record<string, unknown>>(),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("pipeline_runs_status_idx").on(t.status, t.createdAt),
    requestedByIdx: index("pipeline_runs_requested_by_idx").on(t.requestedBy),
    templateIdx: index("pipeline_runs_template_idx").on(t.templateId, t.createdAt),
  }),
);

export const pipelineStepsTable = pgTable(
  "pipeline_steps",
  {
    id: serial("id").primaryKey(),
    runId: integer("run_id").notNull().references(() => pipelineRunsTable.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: text("title").notNull(),
    agentKey: text("agent_key"),
    status: text("status", {
      enum: ["pending", "ready", "running", "needs_confirmation", "completed", "failed", "skipped", "cancelled"],
    }).notNull().default("pending"),
    risk: text("risk", { enum: ["low", "medium", "high"] }).notNull().default("low"),
    requiresConfirmation: boolean("requires_confirmation").notNull().default(false),
    dependsOn: jsonb("depends_on").$type<string[]>().notNull().default([]),
    inputJson: jsonb("input_json").$type<Record<string, unknown>>().notNull().default({}),
    outputJson: jsonb("output_json").$type<Record<string, unknown>>(),
    retryCount: integer("retry_count").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmedBy: integer("confirmed_by").references(() => usersTable.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    runIdx: index("pipeline_steps_run_idx").on(t.runId),
    statusIdx: index("pipeline_steps_status_idx").on(t.status, t.updatedAt),
    keyIdx: index("pipeline_steps_run_key_idx").on(t.runId, t.key),
  }),
);

export type PipelineRun = typeof pipelineRunsTable.$inferSelect;
export type NewPipelineRun = typeof pipelineRunsTable.$inferInsert;
export type PipelineStep = typeof pipelineStepsTable.$inferSelect;
export type NewPipelineStep = typeof pipelineStepsTable.$inferInsert;
