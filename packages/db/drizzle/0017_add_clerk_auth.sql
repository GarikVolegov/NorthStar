-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0017: Add Clerk authentication support
--
-- Adds clerk_id column to users table for Clerk auth integration
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "clerk_id" TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS "users_clerk_id_idx"
  ON "users" ("clerk_id");
