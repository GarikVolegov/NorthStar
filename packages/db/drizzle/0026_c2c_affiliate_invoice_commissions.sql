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
