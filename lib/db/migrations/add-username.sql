-- Migration: add username to users table
-- Run once: psql $DATABASE_URL -f lib/db/migrations/add-username.sql

BEGIN;

-- 1. Add column (nullable first, so existing rows don't fail)
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;

-- 2. Helper: slugify name (lowercase, spaces -> hyphens, strip non-alphanumeric)
-- Used only during backfill, not stored as a function.
UPDATE users
SET username = LOWER(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      COALESCE(NULLIF(TRIM(name), ''), 'utente'),
      '[^a-zA-Z0-9\s-]', '', 'g'   -- strip non-alphanumeric except spaces/hyphens
    ),
    '\s+', '-', 'g'                -- spaces -> hyphens
  )
) || '-' || id::text
WHERE username IS NULL;

-- 3. Ensure uniqueness (backfill should have made them unique via id suffix)
ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);

-- 4. Now make NOT NULL
ALTER TABLE users ALTER COLUMN username SET NOT NULL;

-- 5. Index for fast /u/:username lookups
CREATE INDEX IF NOT EXISTS users_username_idx ON users (username);

-- 6. Index for public profile listing
CREATE INDEX IF NOT EXISTS users_is_public_idx ON users (is_public) WHERE is_public = true;

COMMIT;
