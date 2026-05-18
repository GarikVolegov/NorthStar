CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "content" text NOT NULL,
  "visibility" text DEFAULT 'public' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "social_posts_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "social_stories" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "content" text,
  "media_url" text,
  "visibility" text DEFAULT 'public' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "social_stories_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "social_posts_user_idx" ON "social_posts" ("user_id");
CREATE INDEX IF NOT EXISTS "social_posts_visibility_idx" ON "social_posts" ("visibility");
CREATE INDEX IF NOT EXISTS "social_posts_created_at_idx" ON "social_posts" ("created_at");
CREATE INDEX IF NOT EXISTS "social_stories_user_idx" ON "social_stories" ("user_id");
CREATE INDEX IF NOT EXISTS "social_stories_expires_at_idx" ON "social_stories" ("expires_at");
CREATE INDEX IF NOT EXISTS "social_stories_visibility_idx" ON "social_stories" ("visibility");
