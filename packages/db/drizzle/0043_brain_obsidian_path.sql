-- Migration 0043: Brain runtime RAG source path.
-- Adds an Obsidian-relative path for `.brain` sources and makes it unique so
-- vault ingest can use it as the idempotent upsert target.

ALTER TABLE "rag_sources"
  ADD COLUMN IF NOT EXISTS "obsidian_path" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "rag_sources_obsidian_unique_idx"
  ON "rag_sources" ("obsidian_path");
