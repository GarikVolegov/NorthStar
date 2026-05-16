import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  real,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const llmUsageTable = pgTable(
  "llm_usage",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),

    model: text("model").notNull(),
    provider: text("provider").notNull(),

    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),

    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),

    requestType: text("request_type").notNull(),
    endpoint: text("endpoint"),

    metadata: text("metadata"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index("llm_usage_user_idx").on(t.userId),
    createdIdx: index("llm_usage_created_idx").on(t.createdAt),
    modelIdx: index("llm_usage_model_idx").on(t.model),
    requestTypeIdx: index("llm_usage_request_type_idx").on(t.requestType),
    // Composite index for monthly cost aggregation per user (cost-guard queries)
    userCreatedIdx: index("llm_usage_user_created_idx").on(t.userId, t.createdAt),
  }),
);

export type LlmUsage = typeof llmUsageTable.$inferSelect;
export type InsertLlmUsage = typeof llmUsageTable.$inferInsert;
