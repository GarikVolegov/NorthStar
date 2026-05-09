-- Migration 0043: ensure referral_code is UNIQUE at DB level
-- Idempotente: usa DO $$ ... IF NOT EXISTS per non fallire se già presente.
-- Eseguire con: psql $DATABASE_URL -f lib/db/migrations/0043_affiliate_referral_code_unique.sql

DO $$ BEGIN
  -- Aggiunge il vincolo solo se non esiste già
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    WHERE  t.relname = 'affiliate_accounts'
    AND    c.conname = 'affiliate_accounts_referral_code_unq'
  ) THEN
    ALTER TABLE affiliate_accounts
      ADD CONSTRAINT affiliate_accounts_referral_code_unq
      UNIQUE (referral_code);
  END IF;
END $$;

-- Assicura anche l'unicità di user_id (un solo wallet per utente)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    WHERE  t.relname = 'affiliate_accounts'
    AND    c.conname = 'affiliate_accounts_user_id_unq'
  ) THEN
    ALTER TABLE affiliate_accounts
      ADD CONSTRAINT affiliate_accounts_user_id_unq
      UNIQUE (user_id);
  END IF;
END $$;
