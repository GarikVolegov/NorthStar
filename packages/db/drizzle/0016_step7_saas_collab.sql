-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0016: Step 7 — SaaS maturo, collaborazione, monetizzazione
--
-- Crea 7 nuove tabelle:
--   subscriptions       — piano utente (free/pro/team) con Stripe
--   workspaces          — workspace condivisi
--   workspace_members   — membership con ruolo
--   shared_plans        — piani di studio condivisi
--   plan_comments       — commenti su piani
--   mentor_relationships — relazione 1:1 mentor/mentee
--   wendy_briefings     — briefing generati da Wendy
--
-- Aggiorna user_profile_settings:
--   + horizon            ENUM short|medium|open
--   + onboarding_step    INT (0-4)
--   + wendy_tone_preference ENUM
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id"                      SERIAL PRIMARY KEY,
  "user_id"                 INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id"            INTEGER,
  "plan"                    TEXT NOT NULL DEFAULT 'free',
  "stripe_customer_id"      TEXT,
  "stripe_subscription_id"  TEXT,
  "stripe_price_id"         TEXT,
  "valid_until"             TIMESTAMPTZ,
  "cancelled_at"            TIMESTAMPTZ,
  "created_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "subscriptions_user_idx"
  ON "subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "subscriptions_stripe_sub_idx"
  ON "subscriptions" ("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx"
  ON "subscriptions" ("plan", "cancelled_at");

-- Seed: ogni utente esistente parte con piano free
INSERT INTO "subscriptions" ("user_id", "plan")
SELECT id, 'free' FROM "users"
ON CONFLICT DO NOTHING;

-- 2. workspaces
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id"          SERIAL PRIMARY KEY,
  "name"        TEXT NOT NULL,
  "type"        TEXT NOT NULL DEFAULT 'team',
  "owner_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "description" TEXT,
  "avatar_url"  TEXT,
  "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "workspaces_owner_idx"
  ON "workspaces" ("owner_id");
CREATE INDEX IF NOT EXISTS "workspaces_type_idx"
  ON "workspaces" ("type", "is_active");

-- 3. workspace_members
CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id"            SERIAL PRIMARY KEY,
  "workspace_id"  INTEGER NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id"       INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role"          TEXT NOT NULL DEFAULT 'member',
  "invited_by"    INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "joined_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "workspace_members_unique_idx"
  ON "workspace_members" ("workspace_id", "user_id");
CREATE INDEX IF NOT EXISTS "workspace_members_workspace_idx"
  ON "workspace_members" ("workspace_id");
CREATE INDEX IF NOT EXISTS "workspace_members_user_idx"
  ON "workspace_members" ("user_id");

-- 4. shared_plans
CREATE TABLE IF NOT EXISTS "shared_plans" (
  "id"            SERIAL PRIMARY KEY,
  "workspace_id"  INTEGER NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "owner_id"      INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"         TEXT NOT NULL,
  "description"   TEXT,
  "plan_data"     JSONB,
  "permissions"   TEXT NOT NULL DEFAULT 'comment',
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "shared_plans_workspace_idx"
  ON "shared_plans" ("workspace_id");
CREATE INDEX IF NOT EXISTS "shared_plans_owner_idx"
  ON "shared_plans" ("owner_id");

-- 5. plan_comments
CREATE TABLE IF NOT EXISTS "plan_comments" (
  "id"             SERIAL PRIMARY KEY,
  "shared_plan_id" INTEGER NOT NULL REFERENCES "shared_plans"("id") ON DELETE CASCADE,
  "author_id"      INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content"        TEXT NOT NULL,
  "is_private"     BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "plan_comments_plan_idx"
  ON "plan_comments" ("shared_plan_id");
CREATE INDEX IF NOT EXISTS "plan_comments_author_idx"
  ON "plan_comments" ("author_id");

-- 6. mentor_relationships
CREATE TABLE IF NOT EXISTS "mentor_relationships" (
  "id"            SERIAL PRIMARY KEY,
  "mentor_id"     INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "mentee_id"     INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id"  INTEGER REFERENCES "workspaces"("id") ON DELETE SET NULL,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "started_at"    TIMESTAMPTZ,
  "ended_at"      TIMESTAMPTZ,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS "mentor_rel_unique_idx"
  ON "mentor_relationships" ("mentor_id", "mentee_id");
CREATE INDEX IF NOT EXISTS "mentor_rel_mentor_idx"
  ON "mentor_relationships" ("mentor_id", "status");
CREATE INDEX IF NOT EXISTS "mentor_rel_mentee_idx"
  ON "mentor_relationships" ("mentee_id", "status");

-- 7. wendy_briefings
CREATE TABLE IF NOT EXISTS "wendy_briefings" (
  "id"         SERIAL PRIMARY KEY,
  "user_id"    INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"       TEXT NOT NULL,
  "period"     TEXT NOT NULL,
  "content"    TEXT NOT NULL,
  "read_at"    TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "wendy_briefings_user_idx"
  ON "wendy_briefings" ("user_id");
CREATE INDEX IF NOT EXISTS "wendy_briefings_period_idx"
  ON "wendy_briefings" ("user_id", "period");
CREATE INDEX IF NOT EXISTS "wendy_briefings_type_idx"
  ON "wendy_briefings" ("type", "created_at");

-- 8. Aggiorna user_profile_settings
ALTER TABLE "user_profile_settings"
  ADD COLUMN IF NOT EXISTS "horizon"               TEXT DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS "onboarding_step"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "wendy_tone_preference" TEXT DEFAULT 'auto';
