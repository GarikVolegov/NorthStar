import { pgTable, serial, text, real, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const supervisorLogs = pgTable("supervisor_logs", {
  id:           serial("id").primaryKey(),
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  userId:       text("user_id"),
  sessionId:    integer("session_id"),
  domain:       text("domain").notNull(),
  intent:       text("intent").notNull(),
  userMessage:  text("user_message").notNull(),
  draft:        text("draft").notNull(),
  finalText:    text("final_text").notNull(),
  scoreBefore:  real("score_before").notNull(),
  scoreAfter:   real("score_after"),
  reasons:      text("reasons").notNull(),
});

export type SupervisorLog    = typeof supervisorLogs.$inferSelect;
export type NewSupervisorLog = typeof supervisorLogs.$inferInsert;

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
