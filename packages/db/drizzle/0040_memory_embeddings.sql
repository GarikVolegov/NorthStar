ALTER TABLE coach_memory_patterns
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE coach_memory_facts
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS coach_memory_patterns_embedding_idx
  ON coach_memory_patterns USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS coach_memory_facts_embedding_idx
  ON coach_memory_facts USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;
