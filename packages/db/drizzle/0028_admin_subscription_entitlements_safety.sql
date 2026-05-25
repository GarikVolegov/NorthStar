-- Safety migration for Admin-managed internal subscription entitlements.
-- Idempotent by design: it repairs local/dev databases that missed the
-- original SaaS subscription migration or only have a partial schema.

CREATE TABLE IF NOT EXISTS "subscriptions" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "workspace_id" integer,
  "plan" text NOT NULL DEFAULT 'free',
  "stripe_customer_id" text,
  "stripe_subscription_id" text,
  "stripe_price_id" text,
  "valid_until" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "workspace_id" integer,
  ADD COLUMN IF NOT EXISTS "plan" text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "stripe_customer_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "stripe_price_id" text,
  ADD COLUMN IF NOT EXISTS "valid_until" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

UPDATE "subscriptions"
SET "plan" = 'free'
WHERE "plan" IS NULL OR "plan" NOT IN ('free', 'pro', 'team');

ALTER TABLE "subscriptions"
  ALTER COLUMN "plan" SET DEFAULT 'free',
  ALTER COLUMN "plan" SET NOT NULL,
  ALTER COLUMN "created_at" SET DEFAULT now(),
  ALTER COLUMN "created_at" SET NOT NULL,
  ALTER COLUMN "updated_at" SET DEFAULT now(),
  ALTER COLUMN "updated_at" SET NOT NULL;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "is_premium" boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_plan_check'
  ) THEN
    ALTER TABLE "subscriptions"
      ADD CONSTRAINT "subscriptions_plan_check"
      CHECK ("plan" IN ('free', 'pro', 'team'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "subscriptions"
      ADD CONSTRAINT "subscriptions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "subscriptions_user_idx"
  ON "subscriptions" ("user_id");

CREATE INDEX IF NOT EXISTS "subscriptions_stripe_sub_idx"
  ON "subscriptions" ("stripe_subscription_id");

CREATE INDEX IF NOT EXISTS "subscriptions_plan_idx"
  ON "subscriptions" ("plan", "cancelled_at");
