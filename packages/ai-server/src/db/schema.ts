/**
 * Drizzle ORM schema — NorthStar growth-agent DB.
 *
 * supervisorLogs
 * ───────────────
 * Logged every time SupervisorAgent triggers a rewrite (pass === false).
 * Each row captures the full context needed to learn from the failure:
 *   - what the user asked
 *   - what the specialist drafted
 *   - what the supervisor rewrote
 *   - why it failed (reasons[])
 *   - score before rewrite
 *   - domain + intent metadata
 *
 * The weekly analysis job reads this table to propose new PLATITUDE_PATTERNS
 * and ACTION_PATTERNS to hard-code into supervisor-agent.ts.
 */
import { pgTable, serial, text, real, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const supervisorLogs = pgTable("supervisor_logs", {
  id:           serial("id").primaryKey(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  // Request context
  userId:       text("user_id"),            // nullable: anonymous sessions
  sessionId:    integer("session_id"),      // growth session FK (nullable)
  domain:       text("domain").notNull(),   // "career" | "habits" | "mindset" | "general"
  intent:       text("intent").notNull(),   // "explore" | "plan" | etc.

  // Content
  userMessage:  text("user_message").notNull(),
  draft:        text("draft").notNull(),        // original specialist draft
  finalText:    text("final_text").notNull(),   // rewritten version

  // Quality signals
  scoreBefore:  real("score_before").notNull(), // supervisor score before rewrite
  scoreAfter:   real("score_after"),             // supervisor score after rewrite (nullable: pre-v3 rows)
  reasons:      text("reasons").notNull(),       // JSON array of failure reasons
});

export type SupervisorLog    = typeof supervisorLogs.$inferSelect;
export type NewSupervisorLog = typeof supervisorLogs.$inferInsert;

// ── Quality metrics (per-turn) ──────────────────────────────────────────────

export const qualityMetrics = pgTable("quality_metrics", {
  id:             serial("id").primaryKey(),
  createdAt:      timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  userId:         text("user_id"),
  sessionId:      integer("session_id"),
  domain:         text("domain").notNull(),
  intent:         text("intent").notNull(),
  evalScore:      real("eval_score"),
  supervisorScore: real("supervisor_score"),
  rewritten:      boolean("rewritten").default(false),
  usedUiTool:     boolean("used_ui_tool").default(false),
  needsClarification: boolean("needs_clarification").default(false),
  locale:         text("locale").default("it"),
  responseTimeMs: integer("response_time_ms"),
});

export type QualityMetric    = typeof qualityMetrics.$inferSelect;
export type NewQualityMetric = typeof qualityMetrics.$inferInsert;
