-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: Add persistent memory tables for the growth coach
--
-- Run once:
--   psql $DATABASE_URL -f lib/db/migrations/add-coach-memory.sql
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Table 1: Biographical facts ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_memory_facts (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key              VARCHAR(64) NOT NULL,
  value            TEXT NOT NULL,
  source_session_id INTEGER,
  confirmed_count  INTEGER NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one row per (user, key) — upsert logic in app
CREATE UNIQUE INDEX IF NOT EXISTS coach_memory_facts_user_key
  ON coach_memory_facts (user_id, key);

CREATE INDEX IF NOT EXISTS coach_memory_facts_user_idx
  ON coach_memory_facts (user_id);

-- ── Table 2: Behavioral patterns ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_memory_patterns (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type    VARCHAR(32) NOT NULL,
  description     TEXT NOT NULL,
  confidence      REAL NOT NULL DEFAULT 0.5,
  observed_count  INTEGER NOT NULL DEFAULT 1,
  session_ids     INTEGER[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS coach_memory_patterns_user_idx
  ON coach_memory_patterns (user_id);

CREATE INDEX IF NOT EXISTS coach_memory_patterns_type_idx
  ON coach_memory_patterns (pattern_type);

-- ── updatedAt trigger (reuse existing trigger function if available) ──────────
-- If you already have a set_updated_at() trigger function from updatedAt-trigger.sql:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    CREATE TRIGGER set_updated_at_coach_memory_facts
      BEFORE UPDATE ON coach_memory_facts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    CREATE TRIGGER set_updated_at_coach_memory_patterns
      BEFORE UPDATE ON coach_memory_patterns
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;
