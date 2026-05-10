-- Migration: 0041_wendy_feedback
-- Tabella per il feedback Human-in-the-Loop sulle risposte di Wendy.
--
-- Design choices:
--   - UNIQUE (user_id, message_id): un utente può cambiare voto sullo stesso
--     messaggio (ON CONFLICT DO UPDATE), non duplicare
--   - context JSONB: ultimi 2 messaggi per analisi qualità senza salvare
--     conversazioni complete (privacy-first)
--   - Contatori aggregati su wendy_memory: avg_rating GENERATED permette
--     query veloci senza ricalcolare ogni volta

CREATE TABLE IF NOT EXISTS wendy_feedback (
  id          SERIAL       PRIMARY KEY,
  user_id     TEXT         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id  TEXT         NOT NULL,
  vote        TEXT         NOT NULL CHECK (vote IN ('up', 'down')),
  note        TEXT,
  context     JSONB        NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT wendy_feedback_unique_user_msg UNIQUE (user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_wendy_feedback_user_id
  ON wendy_feedback (user_id);

CREATE INDEX IF NOT EXISTS idx_wendy_feedback_vote_created
  ON wendy_feedback (vote, created_at DESC);

-- Aggiungi colonne aggregate a wendy_memory (creata in 0040)
ALTER TABLE wendy_memory
  ADD COLUMN IF NOT EXISTS upvotes_total   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS downvotes_total INT NOT NULL DEFAULT 0;

-- avg_rating come colonna generata (PostgreSQL 12+)
-- Rappresenta la percentuale di upvote (0.0 — 1.0)
-- NULL se nessun voto ancora ricevuto
ALTER TABLE wendy_memory
  ADD COLUMN IF NOT EXISTS avg_rating FLOAT
    GENERATED ALWAYS AS (
      CASE
        WHEN (upvotes_total + downvotes_total) = 0 THEN NULL
        ELSE upvotes_total::float / (upvotes_total + downvotes_total)
      END
    ) STORED;

COMMENT ON TABLE wendy_feedback IS
  'Feedback 👍/👎 utenti su singole risposte di Wendy (Human-in-the-Loop)';
COMMENT ON COLUMN wendy_feedback.context IS
  '2 messaggi [user, assistant] per analisi qualità — max 500 char per campo';
COMMENT ON COLUMN wendy_memory.avg_rating IS
  'Percentuale soddisfazione 0.0-1.0 (upvotes / totale) — NULL se nessun voto';
