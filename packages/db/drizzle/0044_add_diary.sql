CREATE TABLE IF NOT EXISTS "diary_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "mood" text,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_diary_entries_mood"
    CHECK ("mood" IS NULL OR "mood" IN ('ottimo', 'bene', 'neutro', 'difficile', 'critico'))
);

CREATE TABLE IF NOT EXISTS "diary_ideas" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "importance" text NOT NULL DEFAULT 'media',
  "due_date" timestamp with time zone,
  "emoji" text NOT NULL DEFAULT '💡',
  "completed" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_diary_ideas_importance"
    CHECK ("importance" IN ('bassa', 'media', 'alta'))
);

CREATE TABLE IF NOT EXISTS "investor_analyses" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "sector_id" integer REFERENCES "sectors"("id") ON DELETE SET NULL,
  "sector_name" text NOT NULL,
  "outcome" text NOT NULL,
  "notes" text,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_investor_analyses_outcome"
    CHECK ("outcome" IN ('opportunita', 'rischio', 'neutro'))
);

CREATE INDEX IF NOT EXISTS "diary_entries_user_created_at_idx"
  ON "diary_entries" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "diary_ideas_user_created_at_idx"
  ON "diary_ideas" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "diary_ideas_user_completed_idx"
  ON "diary_ideas" ("user_id", "completed");
CREATE INDEX IF NOT EXISTS "investor_analyses_user_created_at_idx"
  ON "investor_analyses" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "investor_analyses_sector_idx"
  ON "investor_analyses" ("sector_id");
