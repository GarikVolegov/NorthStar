-- ============================================================
-- NorthStar Affiliate Program — DB Migration
-- Run once after deploying the new schema files.
-- Safe to run multiple times (IF NOT EXISTS everywhere).
-- ============================================================

-- 1. affiliate_accounts
CREATE TABLE IF NOT EXISTS affiliate_accounts (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referral_code        TEXT    NOT NULL,
  locked_balance       INTEGER NOT NULL DEFAULT 0,    -- centesimi
  withdrawable_balance INTEGER NOT NULL DEFAULT 0,    -- centesimi
  total_earned         INTEGER NOT NULL DEFAULT 0,    -- centesimi
  total_referrals      INTEGER NOT NULL DEFAULT 0,
  is_premium_active    BOOLEAN NOT NULL DEFAULT FALSE,
  next_renewal_at      TIMESTAMPTZ,
  status               TEXT    NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','paused','suspended')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_accounts_user_id_unq
  ON affiliate_accounts (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS affiliate_accounts_referral_code_unq
  ON affiliate_accounts (referral_code);

-- 2. affiliate_commissions
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id               SERIAL PRIMARY KEY,
  affiliate_id     INTEGER NOT NULL REFERENCES affiliate_accounts(id) ON DELETE CASCADE,
  referred_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents     INTEGER NOT NULL DEFAULT 580,   -- 5.80€
  month            TEXT    NOT NULL,               -- 'YYYY-MM'
  applied_to       TEXT    CHECK (applied_to IN ('locked','withdrawable')),
  status           TEXT    NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','applied','void')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS aff_comm_unique_month
  ON affiliate_commissions (affiliate_id, referred_user_id, month);

CREATE INDEX IF NOT EXISTS aff_comm_affiliate_idx ON affiliate_commissions (affiliate_id);
CREATE INDEX IF NOT EXISTS aff_comm_month_idx     ON affiliate_commissions (month);

-- 3. affiliate_withdrawals
CREATE TABLE IF NOT EXISTS affiliate_withdrawals (
  id           SERIAL PRIMARY KEY,
  affiliate_id INTEGER NOT NULL REFERENCES affiliate_accounts(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  method       TEXT    NOT NULL CHECK (method IN ('paypal','bank_transfer')),
  destination  TEXT,
  status       TEXT    NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at      TIMESTAMPTZ,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS aff_withdrawals_affiliate_idx ON affiliate_withdrawals (affiliate_id);
CREATE INDEX IF NOT EXISTS aff_withdrawals_status_idx    ON affiliate_withdrawals (status);

-- 4. updated_at auto-trigger (riusa la funzione già esistente se presente)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_affiliate_accounts_updated_at') THEN
    CREATE TRIGGER trg_affiliate_accounts_updated_at
      BEFORE UPDATE ON affiliate_accounts
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_affiliate_withdrawals_updated_at') THEN
    CREATE TRIGGER trg_affiliate_withdrawals_updated_at
      BEFORE UPDATE ON affiliate_withdrawals
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
