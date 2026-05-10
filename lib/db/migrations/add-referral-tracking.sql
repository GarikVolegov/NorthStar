-- Migration: referral tracking on users table
-- Run once: psql $DATABASE_URL -f lib/db/migrations/add-referral-tracking.sql

BEGIN;

-- 1. Quale affiliato ha portato questo utente?
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  referred_by_affiliate_id INTEGER REFERENCES affiliate_accounts(id) ON DELETE SET NULL;

-- 2. Timestamp di quando il referral è stato convertito (primo pagamento)
ALTER TABLE users ADD COLUMN IF NOT EXISTS
  referral_converted_at TIMESTAMP WITH TIME ZONE;

-- 3. Indice per join rapidi (affiliato cerca i suoi referral)
CREATE INDEX IF NOT EXISTS users_referred_by_idx
  ON users (referred_by_affiliate_id)
  WHERE referred_by_affiliate_id IS NOT NULL;

COMMIT;
