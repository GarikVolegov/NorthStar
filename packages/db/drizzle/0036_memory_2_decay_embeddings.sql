-- Memory 2.0: decay + semantic search columns.
-- All columns nullable / default-safe — zero downtime migration.

ALTER TABLE coach_memory_patterns
  ADD COLUMN IF NOT EXISTS last_reinforced_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS decay_score        REAL        DEFAULT 1.0;

ALTER TABLE coach_memory_facts
  ADD COLUMN IF NOT EXISTS last_mentioned_at  TIMESTAMPTZ DEFAULT NOW();

-- Semantic search index on patterns (uses existing pgvector extension)
-- Embeddings stored in knowledge_nodes for reuse; memory search joins by description hash.
-- Full vector columns can be added per-table when pgvector storage cost is acceptable.
-- For now the cosine similarity falls back to the in-process embedding cache in memory-manager.ts.

-- Soft-delete index for decay archiver (queries patterns by user + decay_score)
CREATE INDEX CONCURRENTLY IF NOT EXISTS coach_memory_patterns_decay_idx
  ON coach_memory_patterns (user_id, decay_score, updated_at)
  WHERE deleted_at IS NULL;
