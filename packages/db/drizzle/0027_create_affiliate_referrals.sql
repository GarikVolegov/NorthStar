CREATE TABLE IF NOT EXISTS "affiliate_referrals" (
  "id" serial PRIMARY KEY,
  "referrer_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referred_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "affiliate_id" integer NOT NULL REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'active',
  "first_payment_intent_id" text,
  "activated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "cancelled_at" timestamp with time zone
);

ALTER TABLE "affiliate_referrals"
  ADD COLUMN IF NOT EXISTS "referrer_user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "referred_user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "affiliate_id" integer REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "first_payment_intent_id" text,
  ADD COLUMN IF NOT EXISTS "activated_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp with time zone;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_referrals_status_check'
  ) THEN
    ALTER TABLE "affiliate_referrals"
      ADD CONSTRAINT "affiliate_referrals_status_check"
      CHECK ("status" IN ('active', 'cancelled'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aff_ref_unique_referred'
  ) THEN
    ALTER TABLE "affiliate_referrals"
      ADD CONSTRAINT "aff_ref_unique_referred" UNIQUE ("referred_user_id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "aff_ref_referrer_idx"
  ON "affiliate_referrals" ("referrer_user_id");

CREATE INDEX IF NOT EXISTS "aff_ref_referred_idx"
  ON "affiliate_referrals" ("referred_user_id");

CREATE INDEX IF NOT EXISTS "aff_ref_affiliate_idx"
  ON "affiliate_referrals" ("affiliate_id");
