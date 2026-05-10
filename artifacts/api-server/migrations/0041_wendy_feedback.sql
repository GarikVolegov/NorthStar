-- Migration 0041: Wendy 2.0 — feedback messaggi + colonna avg_rating
-- Eseguire con: psql $DATABASE_URL -f migrations/0041_wendy_feedback.sql
-- Idempotente: usa IF NOT EXISTS / ON CONFLICT DO NOTHING

-- ─── 1. Tabella feedback messaggi Wendy ───────────────────────────────────────
-- Memorizza il voto (up/down) dell'utente per ogni messaggio Wendy.
-- message_id è un UUID libero generato dal frontend (non FK obbligatoria).
-- conversation_id permette analisi per conversazione.

CREATE TABLE IF NOT EXISTS wendy_message_feedback (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_id       TEXT        NOT NULL,           -- UUID stringa del messaggio frontend
  conversation_id  TEXT,                           -- ID conversazione opzionale
  rating           SMALLINT    NOT NULL            -- 1 = up (positivo), -1 = down (negativo)
                               CHECK (rating IN (1, -1)),
  feedback_text    TEXT,                           -- commento libero opzionale (max 1000 chars)
  context_snapshot JSONB,                          -- snapshot del contesto (use_case, model, ecc.)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un utente può votare un messaggio una sola volta
  UNIQUE (user_id, message_id)
);

COMMENT ON TABLE wendy_message_feedback IS
  'Feedback utente (up/down) sui messaggi generati da Wendy AI';

-- ─── 2. Indici ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wendy_feedback_user_id
  ON wendy_message_feedback (user_id);

CREATE INDEX IF NOT EXISTS idx_wendy_feedback_message_id
  ON wendy_message_feedback (message_id);

CREATE INDEX IF NOT EXISTS idx_wendy_feedback_created_at
  ON wendy_message_feedback (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wendy_feedback_rating
  ON wendy_message_feedback (rating);

-- ─── 3. Colonna avg_rating su wendy_conversations (se esiste la tabella) ──────
-- Aggiunge avg_rating FLOAT alla tabella wendy_conversations se esiste.
-- Permette di ordinare conversazioni per qualità percepita.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'wendy_conversations'
  ) THEN
    ALTER TABLE wendy_conversations
      ADD COLUMN IF NOT EXISTS avg_rating FLOAT
        GENERATED ALWAYS AS (
          NULL  -- verrà aggiornata dalla funzione trigger sotto
        ) STORED;

    -- Se la colonna è già GENERATED, ricrea come colonna normale aggiornata da trigger
    -- (PostgreSQL non supporta GENERATED AS con subquery — usiamo un trigger)
    ALTER TABLE wendy_conversations
      DROP COLUMN IF EXISTS avg_rating;

    ALTER TABLE wendy_conversations
      ADD COLUMN IF NOT EXISTS avg_rating FLOAT;

    COMMENT ON COLUMN wendy_conversations.avg_rating IS
      'Media ponderata dei feedback messaggi in questa conversazione (-1..1)';
  END IF;
END
$$;

-- ─── 4. Funzione + trigger: aggiorna avg_rating dopo ogni feedback ─────────────
-- Aggiorna wendy_conversations.avg_rating ogni volta che viene inserito/
-- eliminato un feedback, se conversation_id è valorizzato.

CREATE OR REPLACE FUNCTION update_conversation_avg_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_conversation_id TEXT;
BEGIN
  v_conversation_id := COALESCE(NEW.conversation_id, OLD.conversation_id);

  IF v_conversation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'wendy_conversations'
  ) THEN
    UPDATE wendy_conversations
    SET avg_rating = (
      SELECT AVG(rating::FLOAT)
      FROM wendy_message_feedback
      WHERE conversation_id = v_conversation_id
    )
    WHERE id::TEXT = v_conversation_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_wendy_feedback_avg_rating
  AFTER INSERT OR UPDATE OR DELETE
  ON wendy_message_feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_avg_rating();

-- ─── 5. Vista aggregata feedback per admin dashboard ──────────────────────────

CREATE OR REPLACE VIEW v_wendy_feedback_stats AS
SELECT
  DATE_TRUNC('day', created_at)          AS day,
  COUNT(*)                               AS total_votes,
  COUNT(*) FILTER (WHERE rating = 1)     AS thumbs_up,
  COUNT(*) FILTER (WHERE rating = -1)    AS thumbs_down,
  ROUND(
    COUNT(*) FILTER (WHERE rating = 1)::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                      AS satisfaction_pct,
  context_snapshot->>'model'             AS model,
  context_snapshot->>'use_case'          AS use_case
FROM wendy_message_feedback
GROUP BY 1, model, use_case
ORDER BY 1 DESC;

COMMENT ON VIEW v_wendy_feedback_stats IS
  'Statistiche giornaliere feedback Wendy, per modello e use_case';
