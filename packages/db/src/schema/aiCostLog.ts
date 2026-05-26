import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiCostLogTable = pgTable(
  "ai_cost_log",
  {
    id: serial("id").primaryKey(),
    requestId: uuid("request_id").defaultRandom().notNull(),
    parentRequestId: uuid("parent_request_id"),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    sessionId: varchar("session_id", { length: 64 }),
    intent: varchar("intent", { length: 32 }),
    domain: varchar("domain", { length: 32 }),
    tier: varchar("tier", { length: 16 }),
    role: varchar("role", { length: 64 }),
    phase: varchar("phase", { length: 32 }),
    model: varchar("model", { length: 64 }),
    provider: varchar("provider", { length: 32 }),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsdEstimate: numeric("cost_usd_estimate", { precision: 10, scale: 6 }),
    costUsdActual: numeric("cost_usd_actual", { precision: 10, scale: 6 }),
    latencyMs: integer("latency_ms"),
    ttftMs: integer("ttft_ms"),
    supervisorScore: numeric("supervisor_score", { precision: 4, scale: 3 }),
    wasRewritten: boolean("was_rewritten").default(false),
    userFeedback: varchar("user_feedback", { length: 8 }),
    status: varchar("status", { length: 32 }).default("success"),
    errorCode: varchar("error_code", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCreatedIdx: index("ai_cost_log_user_created_idx").on(t.userId, t.createdAt),
    qualityIdx: index("ai_cost_log_quality_idx").on(t.domain, t.intent, t.model, t.createdAt),
    requestIdx: index("ai_cost_log_request_idx").on(t.requestId),
    parentRequestIdx: index("ai_cost_log_parent_request_idx").on(t.parentRequestId),
  }),
);

export type AiCostLog = typeof aiCostLogTable.$inferSelect;
export type InsertAiCostLog = typeof aiCostLogTable.$inferInsert;
