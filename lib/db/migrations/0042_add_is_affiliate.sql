-- Migration: 0042_add_is_affiliate
-- DB_RULES.md: ALTER TABLE additive only. IF NOT EXISTS = idempotente.
-- Autore: feat/affiliate-dashboard
-- Data: 2026-05-09

-- 1. Aggiunge la colonna (sicura se eseguita più volte)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_affiliate BOOLEAN NOT NULL DEFAULT false;

-- 2. Index su tutti i valori (Drizzle non supporta partial index nativo,
--    usiamo l'SQL diretto nella migration)
CREATE INDEX IF NOT EXISTS users_is_affiliate_idx
  ON users (is_affiliate);

-- 3. Commento sulla colonna (utile per pg_dump / ispezione schema)
COMMENT ON COLUMN users.is_affiliate IS
  'true = utente con accesso alla dashboard affiliazione. '
  'Impostato da admin o da processPostPaymentReferral().';
