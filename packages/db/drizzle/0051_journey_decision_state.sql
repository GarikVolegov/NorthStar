ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "journey_decided_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "journey_decision_source" text;
