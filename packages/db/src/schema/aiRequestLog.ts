/**
 * ai_request_log — traccia ogni chiamata AI di Wendy.
 *
 * REGOLA PRIVACY: nessun contenuto integrale di prompt o messaggi.
 * Solo metadati operativi (userId, intent, modello, token, latenza, esito).
 * Retention: 12 mesi (allineato a coach_sessions, vedi PRIVACY_DESIGN.md).
 *
 * userId è nullable con SET NULL: se l'utente si cancella, il log aggregato
 * rimane per analytics ma non è più riconducibile alla persona (GDPR Art. 17).
 */
import {
  pgTable,
  serial,
  integer,
  text,
  real,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const aiRequestLogTable = pgTable(
  "ai_request_log",
  {
    id: serial("id").primaryKey(),

    // ── Identità ──────────────────────────────────────────────────────────
    requestId: text("request_id").notNull(),     // UUID end-to-end (dal frontend)
    userId:    integer("user_id")
      .references(() => usersTable.id, { onDelete: "set null" }), // nullable: GDPR-safe
    threadId:  text("thread_id"),                // coach_sessions.id

    // ── Routing ───────────────────────────────────────────────────────────
    intent: text("intent").notNull(),            // navigation|simple_qa|conversation|planning|deep_analysis
    tier:   text("tier").notNull(),              // nano|micro|standard|reasoning
    model:  text("model").notNull(),             // nome modello esatto (es. deepseek/deepseek-chat-v3-0324:free)

    // ── Token & costo ─────────────────────────────────────────────────────
    inputTokens:  integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsdEst:   real("cost_usd_est").notNull().default(0),
    latencyMs:    integer("latency_ms").notNull().default(0),
    totalTurns:   integer("total_turns").notNull().default(0), // turni storia portati nel prompt

    // ── Esito ─────────────────────────────────────────────────────────────
    status:    text("status").notNull(),         // success | error_model | error_timeout | error_ratelimit | error_internal
    errorCode: text("error_code"),               // nullable, solo su errore

    // ── Tool usage (non-PII, metadati routing) ────────────────────────────
    toolCallsCount: integer("tool_calls_count").notNull().default(0),
    toolsUsed:      text("tools_used").array().notNull().default([]),

    // ── Categoria risposta ────────────────────────────────────────────────
    responseCategory: text("response_category", {
      enum: ["success", "insufficient_data", "refused", "error_tool", "error_model"],
    }),

    // ── Modalità ricerca semantica ────────────────────────────────────────
    searchMode: text("search_mode", {
      enum: ["semantic", "keyword", "none"],
    }),

    // ── Localizzazione ────────────────────────────────────────────────────
    locale: text("locale").notNull().default("it"),

    // ── Audit ─────────────────────────────────────────────────────────────
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx:    index("ai_log_user_idx").on(t.userId),
    intentIdx:  index("ai_log_intent_idx").on(t.intent),
    createdIdx: index("ai_log_created_idx").on(t.createdAt),
    // Aggregazione costi mensili per utente
    userCostIdx: index("ai_log_user_cost_idx").on(t.userId, t.createdAt),
  }),
);

export type AiRequestLog    = typeof aiRequestLogTable.$inferSelect;
export type InsertAiRequestLog = typeof aiRequestLogTable.$inferInsert;
