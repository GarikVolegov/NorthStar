-- Migration 0044: aggiungi city, city_place_id, bio alla tabella users
-- Regola: modifiche additive only, DEFAULT null per compatibilità righe esistenti

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS city          TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS city_place_id TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bio           TEXT    DEFAULT NULL;

-- Index parziale su city per ricerca utenti per città
CREATE INDEX IF NOT EXISTS users_city_idx ON users (city) WHERE city IS NOT NULL;
