ALTER TABLE "sectors"
ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "admin_catalog_drafts" (
  "id" serial PRIMARY KEY,
  "catalog_type" text NOT NULL,
  "entity_id" integer,
  "status" text NOT NULL DEFAULT 'draft',
  "payload" jsonb NOT NULL,
  "validation" jsonb,
  "notes" text,
  "created_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "admin_catalog_drafts_catalog_type_check"
    CHECK ("catalog_type" IN ('sectors', 'professions', 'education_paths', 'growth_articles')),
  CONSTRAINT "admin_catalog_drafts_status_check"
    CHECK ("status" IN ('draft', 'published', 'archived'))
);

CREATE INDEX IF NOT EXISTS "admin_catalog_drafts_type_status_idx"
  ON "admin_catalog_drafts" ("catalog_type", "status");

CREATE INDEX IF NOT EXISTS "admin_catalog_drafts_entity_idx"
  ON "admin_catalog_drafts" ("catalog_type", "entity_id");

CREATE INDEX IF NOT EXISTS "admin_catalog_drafts_created_by_idx"
  ON "admin_catalog_drafts" ("created_by");
