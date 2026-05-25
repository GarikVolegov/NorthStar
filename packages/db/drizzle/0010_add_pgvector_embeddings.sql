-- Enable pgvector when the database host provides the extension.
-- Local development databases may not have pgvector installed; RAG falls back to
-- the JS retriever in that case, so schema migrations must keep progressing.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  ELSE
    RAISE NOTICE 'pgvector extension is not available; skipping vector columns and indexes';
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF to_regtype('vector') IS NOT NULL THEN
    ALTER TABLE sectors ADD COLUMN IF NOT EXISTS embedding vector(1536);
    ALTER TABLE professions ADD COLUMN IF NOT EXISTS embedding vector(1536);
    ALTER TABLE growth_articles ADD COLUMN IF NOT EXISTS embedding vector(1536);
    ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS embedding vector(1536);

    CREATE INDEX IF NOT EXISTS sectors_embedding_idx ON sectors USING hnsw (embedding vector_cosine_ops);
    CREATE INDEX IF NOT EXISTS professions_embedding_idx ON professions USING hnsw (embedding vector_cosine_ops);
    CREATE INDEX IF NOT EXISTS growth_articles_embedding_idx ON growth_articles USING hnsw (embedding vector_cosine_ops);
    CREATE INDEX IF NOT EXISTS news_articles_embedding_idx ON news_articles USING hnsw (embedding vector_cosine_ops);
  END IF;
END $$;
