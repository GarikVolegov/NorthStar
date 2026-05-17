-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0014: Step 6 — RAG, Segnali Deboli, Job Market Intelligence
--
-- Crea 6 nuove tabelle:
--   rag_sources          — sorgenti indicizzate nel knowledge base
--   rag_chunks           — chunk vettoriali (pgvector 1536 dims)
--   weak_signals         — segnali deboli di professioni emergenti
--   job_posting_snapshots — aggregati mensili di job posting
--   skill_cooccurrences  — coppie skill co-ricorrenti
--   proactive_insights   — insight proattivi per utente
--
-- Prerequisiti:
--   CREATE EXTENSION IF NOT EXISTS vector; (già attivo dalla 0010)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. rag_sources
CREATE TABLE IF NOT EXISTS "rag_sources" (
  "id"               SERIAL PRIMARY KEY,
  "name"             TEXT NOT NULL,
  "url"              TEXT,
  "source_type"      TEXT NOT NULL,
  "format"           TEXT NOT NULL,
  "trust_score"      REAL NOT NULL DEFAULT 0.7,
  "geography"        TEXT[] NOT NULL DEFAULT '{}',
  "published_at"     TIMESTAMPTZ,
  "last_ingested_at" TIMESTAMPTZ,
  "created_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "rag_sources_type_idx" ON "rag_sources" ("source_type");
CREATE INDEX IF NOT EXISTS "rag_sources_name_idx" ON "rag_sources" ("name");

-- 2. rag_chunks (dipende da rag_sources)
CREATE TABLE IF NOT EXISTS "rag_chunks" (
  "id"           SERIAL PRIMARY KEY,
  "source_id"    INTEGER NOT NULL REFERENCES "rag_sources"("id") ON DELETE CASCADE,
  "content"      TEXT NOT NULL,
  "chunk_index"  INTEGER NOT NULL,
  "token_count"  INTEGER,
  "embedding"    vector(1536),
  "geography"    TEXT[] NOT NULL DEFAULT '{}',
  "sectors"      TEXT[] NOT NULL DEFAULT '{}',
  "roles"        TEXT[] NOT NULL DEFAULT '{}',
  "trust_score"  REAL NOT NULL DEFAULT 0.7,
  "published_at" TIMESTAMPTZ,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "rag_chunks_source_idx"    ON "rag_chunks" ("source_id");
CREATE INDEX IF NOT EXISTS "rag_chunks_geography_idx" ON "rag_chunks" USING GIN ("geography");
CREATE INDEX IF NOT EXISTS "rag_chunks_published_idx" ON "rag_chunks" ("published_at");
CREATE INDEX IF NOT EXISTS "rag_chunks_trust_idx"     ON "rag_chunks" ("trust_score");

-- Indice IVFFlat per ricerca vettoriale (cosine similarity)
-- lists=100 è adeguato fino a ~1M chunk; incrementare a 200+ oltre 1M righe.
CREATE INDEX IF NOT EXISTS "rag_chunks_embedding_ivfflat_idx"
  ON "rag_chunks" USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- 3. weak_signals
CREATE TABLE IF NOT EXISTS "weak_signals" (
  "id"                     SERIAL PRIMARY KEY,
  "signal_type"            TEXT NOT NULL,
  "title"                  TEXT NOT NULL,
  "description"            TEXT NOT NULL,
  "sources"                TEXT[] NOT NULL DEFAULT '{}',
  "strength"               REAL NOT NULL DEFAULT 0,
  "geographies"            TEXT[] NOT NULL DEFAULT '{}',
  "linked_sector_ids"      TEXT[] NOT NULL DEFAULT '{}',
  "linked_role_ids"        TEXT[] NOT NULL DEFAULT '{}',
  "linked_skill_ids"       TEXT[] NOT NULL DEFAULT '{}',
  "status"                 TEXT NOT NULL DEFAULT 'emerging',
  "confirmation_evidence"  JSONB,
  "first_seen_at"          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "last_seen_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "weak_signals_status_idx"   ON "weak_signals" ("status");
CREATE INDEX IF NOT EXISTS "weak_signals_strength_idx" ON "weak_signals" ("strength");
CREATE INDEX IF NOT EXISTS "weak_signals_type_idx"     ON "weak_signals" ("signal_type");
CREATE INDEX IF NOT EXISTS "weak_signals_seen_idx"     ON "weak_signals" ("last_seen_at");

-- 4. job_posting_snapshots
CREATE TABLE IF NOT EXISTS "job_posting_snapshots" (
  "id"             SERIAL PRIMARY KEY,
  "role_title"     TEXT NOT NULL,
  "sector_id"      INTEGER REFERENCES "sectors"("id") ON DELETE SET NULL,
  "profession_id"  INTEGER REFERENCES "professions"("id") ON DELETE SET NULL,
  "count"          INTEGER NOT NULL,
  "period"         TEXT NOT NULL,
  "geography"      TEXT NOT NULL,
  "top_skills"     TEXT[] NOT NULL DEFAULT '{}',
  "avg_salary_min" INTEGER,
  "avg_salary_max" INTEGER,
  "growth_rate"    REAL,
  "source"         TEXT NOT NULL,
  "created_at"     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "job_posting_snapshots_unique_idx"
  ON "job_posting_snapshots" ("role_title", "period", "geography", "source");
CREATE INDEX IF NOT EXISTS "job_posting_snapshots_period_geo_idx"
  ON "job_posting_snapshots" ("period", "geography");
CREATE INDEX IF NOT EXISTS "job_posting_snapshots_role_title_idx"
  ON "job_posting_snapshots" ("role_title");
CREATE INDEX IF NOT EXISTS "job_posting_snapshots_profession_idx"
  ON "job_posting_snapshots" ("profession_id");
CREATE INDEX IF NOT EXISTS "job_posting_snapshots_sector_idx"
  ON "job_posting_snapshots" ("sector_id");

-- 5. skill_cooccurrences
CREATE TABLE IF NOT EXISTS "skill_cooccurrences" (
  "id"              SERIAL PRIMARY KEY,
  "skill_name"      TEXT NOT NULL,
  "co_skill_name"   TEXT NOT NULL,
  "frequency"       INTEGER NOT NULL,
  "frequency_rate"  REAL NOT NULL,
  "profession_id"   INTEGER REFERENCES "professions"("id") ON DELETE SET NULL,
  "period"          TEXT NOT NULL,
  "source"          TEXT NOT NULL,
  "created_at"      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS "skill_cooccurrences_unique_idx"
  ON "skill_cooccurrences" ("skill_name", "co_skill_name", "period", "profession_id");
CREATE INDEX IF NOT EXISTS "skill_cooccurrences_skill_idx"   ON "skill_cooccurrences" ("skill_name");
CREATE INDEX IF NOT EXISTS "skill_cooccurrences_coskill_idx" ON "skill_cooccurrences" ("co_skill_name");
CREATE INDEX IF NOT EXISTS "skill_cooccurrences_period_idx"  ON "skill_cooccurrences" ("period");

-- 6. proactive_insights
CREATE TABLE IF NOT EXISTS "proactive_insights" (
  "id"                   SERIAL PRIMARY KEY,
  "user_id"              INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "insight_type"         TEXT NOT NULL,
  "title"                TEXT NOT NULL,
  "body"                 TEXT NOT NULL,
  "cta_label"            TEXT,
  "cta_target"           TEXT,
  "linked_weak_signal_id" INTEGER REFERENCES "weak_signals"("id") ON DELETE SET NULL,
  "linked_rag_chunk_id"  INTEGER REFERENCES "rag_chunks"("id") ON DELETE SET NULL,
  "read_at"              TIMESTAMPTZ,
  "dismissed_at"         TIMESTAMPTZ,
  "created_at"           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "proactive_insights_user_idx"
  ON "proactive_insights" ("user_id");
CREATE INDEX IF NOT EXISTS "proactive_insights_user_unread_idx"
  ON "proactive_insights" ("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "proactive_insights_type_idx"
  ON "proactive_insights" ("insight_type");
CREATE INDEX IF NOT EXISTS "proactive_insights_created_idx"
  ON "proactive_insights" ("created_at");
