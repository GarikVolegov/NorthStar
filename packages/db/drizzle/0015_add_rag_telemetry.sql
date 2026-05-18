-- Migration 0015: Aggiunge campi RAG telemetria in ai_request_log
--
-- Aggiunge:
--   rag_chunks_retrieved INT    — numero chunk recuperati dal RAG
--   rag_top_similarity   REAL   — score cosine del chunk più rilevante
--   rag_sources_used     TEXT[] — nomi delle fonti RAG usate

CREATE TABLE IF NOT EXISTS "ai_request_log" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "request_id" TEXT NOT NULL,
  "user_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "thread_id" TEXT,
  "intent" TEXT NOT NULL,
  "tier" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "input_tokens" INTEGER DEFAULT 0 NOT NULL,
  "output_tokens" INTEGER DEFAULT 0 NOT NULL,
  "cost_usd_est" REAL DEFAULT 0 NOT NULL,
  "latency_ms" INTEGER DEFAULT 0 NOT NULL,
  "total_turns" INTEGER DEFAULT 0 NOT NULL,
  "status" TEXT NOT NULL,
  "error_code" TEXT,
  "tool_calls_count" INTEGER DEFAULT 0 NOT NULL,
  "tools_used" TEXT[] DEFAULT '{}' NOT NULL,
  "response_category" TEXT,
  "search_mode" TEXT,
  "locale" TEXT DEFAULT 'it' NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE "ai_request_log"
  ADD COLUMN IF NOT EXISTS "rag_chunks_retrieved" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "rag_top_similarity"   REAL,
  ADD COLUMN IF NOT EXISTS "rag_sources_used"     TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "ai_log_user_idx" ON "ai_request_log" ("user_id");
CREATE INDEX IF NOT EXISTS "ai_log_intent_idx" ON "ai_request_log" ("intent");
CREATE INDEX IF NOT EXISTS "ai_log_created_idx" ON "ai_request_log" ("created_at");
CREATE INDEX IF NOT EXISTS "ai_log_user_cost_idx" ON "ai_request_log" ("user_id", "created_at");
