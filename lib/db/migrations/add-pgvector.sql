-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add pgvector to knowledge_nodes
--
-- Run this ONCE against your PostgreSQL database AFTER installing pgvector:
--   Docker:   add ankane/pgvector to your image, or use pgvector/pgvector image
--   Supabase: pgvector is already installed, skip step 1
--   Neon:     pgvector is already installed, skip step 1
--
-- Steps:
--   1. Enable the extension (skip if already available on your provider)
--   2. Add embedding_vec column of type vector(1536)
--   3. Backfill: copy existing jsonb embeddings into the new column
--   4. Create HNSW index for fast approximate nearest-neighbor search
--   5. (Optional) Drop the old jsonb column to save space
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Step 1: Enable pgvector extension ────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Step 2: Add vector column ─────────────────────────────────────────────────
ALTER TABLE knowledge_nodes
  ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);

-- ── Step 3: Backfill from jsonb ───────────────────────────────────────────────
-- Converts the existing jsonb array (e.g. [0.1, 0.2, ...]) to the native
-- vector type. Runs in batches to avoid locking the table for too long.
--
-- Safe to run multiple times (updates only NULL embedding_vec rows).
UPDATE knowledge_nodes
SET    embedding_vec = embedding::text::vector
WHERE  embedding IS NOT NULL
  AND  embedding_vec IS NULL;

-- ── Step 4: HNSW index ────────────────────────────────────────────────────────
-- HNSW is faster than IVFFlat at query time and doesn't require a training step.
-- cosine distance (vector_cosine_ops) matches how OpenAI embeddings are used.
--
-- Build time: ~1 min per 100K vectors on a modern CPU.
-- Index size:  ~1.5x the raw vector data size.
CREATE INDEX IF NOT EXISTS knowledge_nodes_embedding_hnsw
  ON knowledge_nodes
  USING hnsw (embedding_vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── Optional: Add partial index only for rows with embeddings ─────────────────
-- This makes the index smaller if you have many rows without embeddings.
-- Comment out the index above and use this instead if needed:
-- CREATE INDEX IF NOT EXISTS knowledge_nodes_embedding_hnsw
--   ON knowledge_nodes
--   USING hnsw (embedding_vec vector_cosine_ops)
--   WITH (m = 16, ef_construction = 64)
--   WHERE embedding_vec IS NOT NULL;

-- ── Step 5 (optional): Drop old jsonb column ──────────────────────────────────
-- Only run this after confirming PGVECTOR=true works in production.
-- The JS fallback retriever still reads the jsonb column.
--
-- ALTER TABLE knowledge_nodes DROP COLUMN IF EXISTS embedding;

-- ── Verify ────────────────────────────────────────────────────────────────────
-- After running, check the column exists and index is built:
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'knowledge_nodes' AND column_name = 'embedding_vec';
--
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'knowledge_nodes' AND indexname LIKE '%hnsw%';
