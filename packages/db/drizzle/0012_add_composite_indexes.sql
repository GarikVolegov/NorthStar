-- Add composite index for LLM cost aggregation queries (user_id + created_at)
CREATE INDEX IF NOT EXISTS llm_usage_user_created_idx ON llm_usage (user_id, created_at);

-- Add index on users.email for JOIN performance (unique constraint already creates unique index,
-- but a non-unique index can be more flexible for certain query patterns)
CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);