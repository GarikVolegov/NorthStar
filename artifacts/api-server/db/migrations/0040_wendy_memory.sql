-- Migration: 0040_wendy_memory
-- Crea la tabella per la memoria a lungo termine di Wendy.
-- Ogni utente ha una riga con lo storico dei riassunti delle sessioni.
--
-- Design choices:
--   - sessions è JSONB array (non tabella separata) perché:
--     a) Le sessioni sono dati semi-strutturati letti sempre insieme
--     b) Non servono query complesse sui singoli messaggi
--     c) Semplifica la migration (nessuna FK aggiuntiva)
--   - LIMIT 20 nelle sessioni applicato a livello applicativo in wendy-memory.ts
--   - ON CONFLICT DO UPDATE gestisce upsert senza race condition

CREATE TABLE IF NOT EXISTS wendy_memory (
  user_id    TEXT        NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sessions   JSONB       NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wendy_memory_updated_at
  ON wendy_memory (updated_at DESC);

COMMENT ON TABLE wendy_memory IS
  'Memoria a lungo termine di Wendy — riassunti sessioni chat per utente';
COMMENT ON COLUMN wendy_memory.sessions IS
  'Array JSON di { date, summary, topics[], messageCount } — max 20 voci, LIFO';
