CREATE TABLE IF NOT EXISTS "agent_prompts" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "label" text NOT NULL,
  "description" text NOT NULL,
  "default_value" text NOT NULL,
  "placeholders" text[] DEFAULT '{}' NOT NULL,
  "required_placeholders" text[] DEFAULT '{}' NOT NULL,
  "active_version_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "agent_prompt_versions" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt_id" integer NOT NULL,
  "version_number" integer NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "value" text NOT NULL,
  "notes" text,
  "created_by" integer,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "agent_prompt_versions"
    ADD CONSTRAINT "agent_prompt_versions_prompt_id_agent_prompts_id_fk"
    FOREIGN KEY ("prompt_id") REFERENCES "agent_prompts"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "agent_prompt_versions"
    ADD CONSTRAINT "agent_prompt_versions_created_by_users_id_fk"
    FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "agent_prompts_key_idx" ON "agent_prompts" ("key");
CREATE INDEX IF NOT EXISTS "agent_prompts_active_version_idx" ON "agent_prompts" ("active_version_id");
CREATE INDEX IF NOT EXISTS "agent_prompt_versions_prompt_idx" ON "agent_prompt_versions" ("prompt_id");
CREATE INDEX IF NOT EXISTS "agent_prompt_versions_prompt_status_idx" ON "agent_prompt_versions" ("prompt_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_prompt_versions_prompt_version_idx" ON "agent_prompt_versions" ("prompt_id", "version_number");
