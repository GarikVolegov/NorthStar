-- Enable pgvector extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint

-- Add embedding columns to searchable tables
ALTER TABLE sectors ADD COLUMN IF NOT EXISTS embedding vector(1536);
--> statement-breakpoint
ALTER TABLE professions ADD COLUMN IF NOT EXISTS embedding vector(1536);
--> statement-breakpoint
ALTER TABLE growth_articles ADD COLUMN IF NOT EXISTS embedding vector(1536);
--> statement-breakpoint
ALTER TABLE news_articles ADD COLUMN IF NOT EXISTS embedding vector(1536);
--> statement-breakpoint

-- HNSW indexes for fast vector search
CREATE INDEX IF NOT EXISTS sectors_embedding_idx ON sectors USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS professions_embedding_idx ON professions USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS growth_articles_embedding_idx ON growth_articles USING hnsw (embedding vector_cosine_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS news_articles_embedding_idx ON news_articles USING hnsw (embedding vector_cosine_ops);
