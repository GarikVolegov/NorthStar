ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_premium" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_admin" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "purged_at" timestamp with time zone;

UPDATE "users"
SET "is_premium" = COALESCE("is_premium", false),
    "is_admin" = COALESCE("is_admin", false);
