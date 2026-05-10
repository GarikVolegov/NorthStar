-- Migration: add coach_sessions table
-- Tracks per-session analytics for the growth coach.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS coach_sessions (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at         TIMESTAMPTZ,
  message_count    INTEGER NOT NULL DEFAULT 0,
  -- Array of topic strings extracted by the agent after each session
  topics           TEXT[] NOT NULL DEFAULT '{}',
  -- Average self-evaluation confidence score for this session (0-1)
  avg_confidence   REAL,
  -- JSON snapshot of evalResult breakdown for the session
  eval_breakdown   JSONB
);

CREATE INDEX IF NOT EXISTS coach_sessions_user_id_idx
  ON coach_sessions (user_id);

CREATE INDEX IF NOT EXISTS coach_sessions_started_at_idx
  ON coach_sessions (user_id, started_at DESC);

-- Populate avg_confidence from existing sessions if re-running migration
-- (no-op on fresh install)
COMMENT ON TABLE coach_sessions IS
  'Per-session analytics for the NorthStar growth coach. '
  'Populated by the memory extractor after each session ends.';
