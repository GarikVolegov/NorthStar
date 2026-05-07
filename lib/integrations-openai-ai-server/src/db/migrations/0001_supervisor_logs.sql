-- Migration 0001: supervisor_logs table
-- Run with: drizzle-kit push or your migration runner

CREATE TABLE IF NOT EXISTS supervisor_logs (
  id           SERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Request context
  user_id      TEXT,
  session_id   INTEGER,
  domain       TEXT NOT NULL,
  intent       TEXT NOT NULL,

  -- Content
  user_message TEXT NOT NULL,
  draft        TEXT NOT NULL,
  final_text   TEXT NOT NULL,

  -- Quality signals
  score_before REAL    NOT NULL,
  reasons      TEXT    NOT NULL   -- JSON array
);

CREATE INDEX IF NOT EXISTS supervisor_logs_domain_idx    ON supervisor_logs (domain);
CREATE INDEX IF NOT EXISTS supervisor_logs_created_at_idx ON supervisor_logs (created_at DESC);
