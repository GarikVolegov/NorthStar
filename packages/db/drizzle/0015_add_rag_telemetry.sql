-- Migration 0015: Aggiunge campi RAG telemetria in ai_request_log
--
-- Aggiunge:
--   rag_chunks_retrieved INT    — numero chunk recuperati dal RAG
--   rag_top_similarity   REAL   — score cosine del chunk più rilevante
--   rag_sources_used     TEXT[] — nomi delle fonti RAG usate

ALTER TABLE "ai_request_log"
  ADD COLUMN IF NOT EXISTS "rag_chunks_retrieved" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rag_top_similarity"   REAL,
  ADD COLUMN IF NOT EXISTS "rag_sources_used"     TEXT[] NOT NULL DEFAULT '{}';
