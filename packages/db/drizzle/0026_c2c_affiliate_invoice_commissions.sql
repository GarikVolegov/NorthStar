CREATE TABLE IF NOT EXISTS "affiliate_accounts" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "referral_code" text NOT NULL,
  "locked_balance" integer NOT NULL DEFAULT 0,
  "withdrawable_balance" integer NOT NULL DEFAULT 0,
  "total_earned" integer NOT NULL DEFAULT 0,
  "total_referrals" integer NOT NULL DEFAULT 0,
  "is_premium_active" boolean NOT NULL DEFAULT false,
  "next_renewal_at" timestamptz,
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "affiliate_accounts_user_id_idx"
  ON "affiliate_accounts" ("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_accounts_referral_code_unq'
  ) THEN
    ALTER TABLE "affiliate_accounts"
      ADD CONSTRAINT "affiliate_accounts_referral_code_unq" UNIQUE ("referral_code");
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "affiliate_withdrawals" (
  "id" serial PRIMARY KEY,
  "affiliate_id" integer NOT NULL REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE,
  "amount_cents" integer NOT NULL,
  "method" text NOT NULL,
  "destination" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "paid_at" timestamptz,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "aff_withdrawals_affiliate_idx"
  ON "affiliate_withdrawals" ("affiliate_id");
CREATE INDEX IF NOT EXISTS "aff_withdrawals_status_idx"
  ON "affiliate_withdrawals" ("status");

CREATE TABLE IF NOT EXISTS "affiliate_commissions" (
  "id" serial PRIMARY KEY,
  "affiliate_id" integer NOT NULL REFERENCES "affiliate_accounts"("id") ON DELETE CASCADE,
  "referred_user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "amount_cents" integer NOT NULL DEFAULT 580,
  "month" text NOT NULL,
  "applied_to" text,
  "status" text NOT NULL DEFAULT 'pending',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "applied_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "aff_comm_affiliate_idx"
  ON "affiliate_commissions" ("affiliate_id");
CREATE INDEX IF NOT EXISTS "aff_comm_month_idx"
  ON "affiliate_commissions" ("month");

ALTER TABLE "affiliate_commissions"
  ADD COLUMN IF NOT EXISTS "stripe_invoice_id" text,
  ADD COLUMN IF NOT EXISTS "source_amount_cents" integer,
  ADD COLUMN IF NOT EXISTS "commission_rate_pct" integer;

ALTER TABLE "affiliate_commissions"
  DROP CONSTRAINT IF EXISTS "aff_comm_unique_month";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'aff_comm_stripe_invoice_unq'
  ) THEN
    ALTER TABLE "affiliate_commissions"
      ADD CONSTRAINT "aff_comm_stripe_invoice_unq" UNIQUE ("stripe_invoice_id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "aff_comm_stripe_invoice_idx"
  ON "affiliate_commissions" ("stripe_invoice_id");
