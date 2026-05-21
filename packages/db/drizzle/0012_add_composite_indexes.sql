-- Add composite index for LLM cost aggregation queries (user_id + created_at)
CREATE TABLE IF NOT EXISTS llm_usage (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model text NOT NULL,
  provider text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  estimated_cost_usd real NOT NULL DEFAULT 0,
  request_type text NOT NULL,
  endpoint text,
  metadata text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS llm_usage_user_idx ON llm_usage (user_id);
CREATE INDEX IF NOT EXISTS llm_usage_created_idx ON llm_usage (created_at);
CREATE INDEX IF NOT EXISTS llm_usage_model_idx ON llm_usage (model);
CREATE INDEX IF NOT EXISTS llm_usage_request_type_idx ON llm_usage (request_type);
CREATE INDEX IF NOT EXISTS llm_usage_user_created_idx ON llm_usage (user_id, created_at);

-- Add index on users.email for JOIN performance (unique constraint already creates unique index,
-- but a non-unique index can be more flexible for certain query patterns)
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
