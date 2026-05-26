/**
 * ai_request_log — traccia ogni chiamata AI di Wendy.
 *
 * REGOLA PRIVACY: nessun contenuto integrale di prompt o messaggi.
 * Solo metadati operativi (userId, intent, modello, token, latenza, esito).
 * Retention: 12 mesi (allineato a coach_sessions, vedi PRIVACY_DESIGN.md).
 *
 * userId è nullable con SET NULL: se l'utente si cancella, il log aggregato
 * rimane per analytics ma non è più riconducibile alla persona (GDPR Art. 17).
 *
 * Phase 2 additions: domain, supervisorScore, wasRewritten, ttftMs.
 * cost-guard now reads costUsdEst from this table — llm_usage is deprecated.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  real,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiRequestLogTable = pgTable(
  "ai_request_log",
  {
    id: serial("id").primaryKey(),

    // Identity
    requestId: text("request_id").notNull(),
    userId:    integer("user_id")
      .references(() => usersTable.id, { onDelete: "set null" }),
    threadId:  text("thread_id"),

    // Routing
    intent: text("intent").notNull(),
    tier:   text("tier").notNull(),
    model:  text("model").notNull(),
    domain: text("domain"),   // career|mindset|habits|... — null on fast path

    // Tokens & cost
    inputTokens:  integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsdEst:   real("cost_usd_est").notNull().default(0),
    latencyMs:    integer("latency_ms").notNull().default(0),
    ttftMs:       integer("ttft_ms"),          // ms to first streamed token
    totalTurns:   integer("total_turns").notNull().default(0),

    // Quality (Phase 2)
    supervisorScore: real("supervisor_score"),                // 0–1, null if not invoked
    wasRewritten:    boolean("was_rewritten").default(false), // supervisor triggered rewrite

    // Outcome
    status:    text("status").notNull(),
    errorCode: text("error_code"),

    // Tool usage
    toolCallsCount: integer("tool_calls_count").notNull().default(0),
    toolsUsed:      text("tools_used").array().notNull().default([]),

    // Response category
    responseCategory: text("response_category", {
      enum: ["success", "insufficient_data", "refused", "error_tool", "error_model"],
    }),

    // Search mode
    searchMode: text("search_mode", {
      enum: ["semantic", "keyword", "none"],
    }),

    // RAG telemetry (Step 6)
    ragChunksRetrieved: integer("rag_chunks_retrieved").notNull().default(0),
    ragTopSimilarity:   real("rag_top_similarity"),
    ragSourcesUsed:     text("rag_sources_used").array().notNull().default([]),

    // Locale
    locale: text("locale").notNull().default("it"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:    index("ai_log_user_idx").on(t.userId),
    intentIdx:  index("ai_log_intent_idx").on(t.intent),
    createdIdx: index("ai_log_created_idx").on(t.createdAt),
    domainIdx:  index("ai_log_domain_idx").on(t.domain),
    // Monthly cost aggregation per user — used by cost-guard
    userCostIdx: index("ai_log_user_cost_idx").on(t.userId, t.createdAt),
    // Quality optimizer: domain x intent x model
    qualityIdx: index("ai_log_quality_idx").on(t.domain, t.intent, t.model, t.createdAt),
  }),
);

export type AiRequestLog    = typeof aiRequestLogTable.$inferSelect;
export type InsertAiRequestLog = typeof aiRequestLogTable.$inferInsert;
