CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS "app_search_index" (
  "id" serial PRIMARY KEY,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "user_id" integer REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "url" text NOT NULL,
  "visibility" text NOT NULL DEFAULT 'public',
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "embedding" vector(1536),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "app_search_index_entity_type_check"
    CHECK ("entity_type" IN ('sector', 'role', 'article', 'news', 'idea', 'objective', 'calendar', 'certification', 'memory', 'workspace', 'profile')),
  CONSTRAINT "app_search_index_visibility_check"
    CHECK ("visibility" IN ('public', 'private'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "app_search_index_entity_unique"
  ON "app_search_index" ("entity_type", "entity_id", COALESCE("user_id", 0));

CREATE INDEX IF NOT EXISTS "app_search_index_visibility_idx"
  ON "app_search_index" ("visibility");

CREATE INDEX IF NOT EXISTS "app_search_index_user_idx"
  ON "app_search_index" ("user_id");

CREATE INDEX IF NOT EXISTS "app_search_index_type_idx"
  ON "app_search_index" ("entity_type");

CREATE INDEX IF NOT EXISTS "app_search_index_updated_at_idx"
  ON "app_search_index" ("updated_at");

CREATE INDEX IF NOT EXISTS "app_search_index_embedding_idx"
  ON "app_search_index" USING hnsw ("embedding" vector_cosine_ops);

INSERT INTO "app_search_index" ("entity_type", "entity_id", "title", "content", "url", "visibility", "metadata", "updated_at")
SELECT
  'sector',
  s."id"::text,
  s."name",
  COALESCE(s."description", ''),
  '/settore/' || s."id",
  'public',
  jsonb_build_object('source', 'sectors'),
  COALESCE(s."updated_at", now())
FROM "sectors" s
ON CONFLICT ("entity_type", "entity_id", COALESCE("user_id", 0)) DO UPDATE
SET "title" = EXCLUDED."title",
    "content" = EXCLUDED."content",
    "url" = EXCLUDED."url",
    "metadata" = EXCLUDED."metadata",
    "updated_at" = EXCLUDED."updated_at";

INSERT INTO "app_search_index" ("entity_type", "entity_id", "title", "content", "url", "visibility", "metadata", "updated_at")
SELECT
  'role',
  p."id"::text,
  p."title",
  COALESCE(p."description", ''),
  '/ruolo/' || p."id",
  'public',
  jsonb_build_object('source', 'professions'),
  COALESCE(p."updated_at", now())
FROM "professions" p
ON CONFLICT ("entity_type", "entity_id", COALESCE("user_id", 0)) DO UPDATE
SET "title" = EXCLUDED."title",
    "content" = EXCLUDED."content",
    "url" = EXCLUDED."url",
    "metadata" = EXCLUDED."metadata",
    "updated_at" = EXCLUDED."updated_at";

INSERT INTO "app_search_index" ("entity_type", "entity_id", "title", "content", "url", "visibility", "metadata", "updated_at")
SELECT
  'article',
  ga."id"::text,
  ga."title",
  COALESCE(ga."description", ''),
  '/crescita/articolo/' || ga."slug",
  'public',
  jsonb_build_object('source', 'growth_articles', 'category', ga."category"),
  COALESCE(ga."updated_at", now())
FROM "growth_articles" ga
WHERE ga."status" = 'published'
ON CONFLICT ("entity_type", "entity_id", COALESCE("user_id", 0)) DO UPDATE
SET "title" = EXCLUDED."title",
    "content" = EXCLUDED."content",
    "url" = EXCLUDED."url",
    "metadata" = EXCLUDED."metadata",
    "updated_at" = EXCLUDED."updated_at";

INSERT INTO "app_search_index" ("entity_type", "entity_id", "title", "content", "url", "visibility", "metadata", "updated_at")
SELECT
  'news',
  n."id"::text,
  n."title",
  COALESCE(n."summary", ''),
  '/news/' || n."id",
  'public',
  jsonb_build_object('source', 'news_articles', 'category', n."category"),
  COALESCE(n."created_at", now())
FROM "news_articles" n
ON CONFLICT ("entity_type", "entity_id", COALESCE("user_id", 0)) DO UPDATE
SET "title" = EXCLUDED."title",
    "content" = EXCLUDED."content",
    "url" = EXCLUDED."url",
    "metadata" = EXCLUDED."metadata",
    "updated_at" = EXCLUDED."updated_at";
