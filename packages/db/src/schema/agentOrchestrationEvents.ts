import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export type AgentOrchestrationEventStatus =
  | "planned"
  | "dispatched"
  | "completed"
  | "failed";

export const agentOrchestrationEventsTable = pgTable(
  "agent_orchestration_events",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
    source: text("source").notNull(),
    triggerType: text("trigger_type").notNull(),
    decision: text("decision").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    status: text("status", {
      enum: ["planned", "dispatched", "completed", "failed"],
    }).$type<AgentOrchestrationEventStatus>().notNull().default("planned"),
    inputSummary: text("input_summary").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("idx_agent_orchestration_events_user_created").on(t.userId, t.createdAt),
    statusIdx: index("idx_agent_orchestration_events_status").on(t.status),
    targetIdx: index("idx_agent_orchestration_events_target").on(t.targetType, t.targetId),
    decisionIdx: index("idx_agent_orchestration_events_decision").on(t.decision),
  }),
);

export type AgentOrchestrationEvent = typeof agentOrchestrationEventsTable.$inferSelect;
export type NewAgentOrchestrationEvent = typeof agentOrchestrationEventsTable.$inferInsert;
