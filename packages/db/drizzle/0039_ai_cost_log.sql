CREATE TABLE IF NOT EXISTS ai_cost_log (
  id SERIAL PRIMARY KEY,
  request_id UUID NOT NULL DEFAULT gen_random_uuid(),
  parent_request_id UUID,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  session_id VARCHAR(64),
  intent VARCHAR(32),
  domain VARCHAR(32),
  tier VARCHAR(16),
  role VARCHAR(64),
  phase VARCHAR(32),
  model VARCHAR(64),
  provider VARCHAR(32),
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_usd_estimate NUMERIC(10, 6),
  cost_usd_actual NUMERIC(10, 6),
  latency_ms INTEGER,
  ttft_ms INTEGER,
  supervisor_score NUMERIC(4, 3),
  was_rewritten BOOLEAN DEFAULT FALSE,
  user_feedback VARCHAR(8),
  status VARCHAR(32) DEFAULT 'success',
  error_code VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_cost_log_user_created_idx
  ON ai_cost_log (user_id, created_at);

CREATE INDEX IF NOT EXISTS ai_cost_log_quality_idx
  ON ai_cost_log (domain, intent, model, created_at);

CREATE INDEX IF NOT EXISTS ai_cost_log_request_idx
  ON ai_cost_log (request_id);

CREATE INDEX IF NOT EXISTS ai_cost_log_parent_request_idx
  ON ai_cost_log (parent_request_id);
