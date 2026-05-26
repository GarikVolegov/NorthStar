-- Phase 2: extend ai_request_log with quality + domain telemetry.
-- Migrates cost-guard off llm_usage (deprecated) to ai_request_log.
-- All new columns are nullable — safe to apply with zero downtime.

ALTER TABLE ai_request_log
  ADD COLUMN IF NOT EXISTS domain            TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_score  REAL,
  ADD COLUMN IF NOT EXISTS was_rewritten     BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ttft_ms           INTEGER;

-- Quality optimizer index: supports GROUP BY domain, intent, model queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_log_domain_idx
  ON ai_request_log (domain);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_log_quality_idx
  ON ai_request_log (domain, intent, model, created_at);

-- NOTE: llm_usage is deprecated as of this migration.
-- cost-guard now reads from ai_request_log.cost_usd_est.
-- Drop llm_usage after 30 days when no active writes remain:
--   DROP TABLE IF EXISTS llm_usage;
