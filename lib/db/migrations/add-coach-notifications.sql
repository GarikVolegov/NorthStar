-- Migration: coach_notifications table
-- Stores in-app notifications (weekly digest, milestones, etc.)
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS coach_notifications (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  type        TEXT    NOT NULL DEFAULT 'weekly_digest',
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coach_notifications_user_idx
  ON coach_notifications (user_id, created_at DESC);

COMMENT ON TABLE coach_notifications IS
  'In-app notifications for NorthStar growth coach. '
  'Currently used for weekly digest summaries.';
