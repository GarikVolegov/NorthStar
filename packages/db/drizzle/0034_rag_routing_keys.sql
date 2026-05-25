-- Migration 0034: RAG sparse routing keys.
-- Stores one routing embedding per RAG source for two-level retrieval.

CREATE TABLE IF NOT EXISTS "rag_routing_keys" (
  "source_id" INTEGER PRIMARY KEY REFERENCES "rag_sources"("id") ON DELETE CASCADE,
  "chunk_count" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF to_regtype('vector') IS NOT NULL THEN
    ALTER TABLE "rag_routing_keys"
      ADD COLUMN IF NOT EXISTS "routing_embedding" vector(1536);

    CREATE INDEX IF NOT EXISTS "rag_routing_keys_embedding_ivfflat_idx"
      ON "rag_routing_keys" USING ivfflat ("routing_embedding" vector_cosine_ops)
      WITH (lists = 16);
  ELSE
    ALTER TABLE "rag_routing_keys"
      ADD COLUMN IF NOT EXISTS "routing_embedding" JSONB;
    RAISE NOTICE 'pgvector type is not available; rag_routing_keys.routing_embedding uses JSONB fallback';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "rag_routing_keys_updated_at_idx"
  ON "rag_routing_keys" ("updated_at");
