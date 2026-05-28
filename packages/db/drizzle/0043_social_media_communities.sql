ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "media_url" text;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "media_type" text;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "media_description" text;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "hashtags" text[] DEFAULT '{}'::text[] NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ck_social_posts_media_type'
  ) THEN
    ALTER TABLE "social_posts"
      ADD CONSTRAINT "ck_social_posts_media_type"
      CHECK ("media_type" IS NULL OR "media_type" IN ('image', 'video'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "communities" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "icon" text DEFAULT '#' NOT NULL,
  "is_public" boolean DEFAULT true NOT NULL,
  "creator_id" integer NOT NULL,
  "member_count" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "communities_creator_id_users_id_fk"
    FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "community_members" (
  "id" serial PRIMARY KEY NOT NULL,
  "community_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "role" text DEFAULT 'member' NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_members_community_id_communities_id_fk"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE cascade,
  CONSTRAINT "community_members_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "community_channels" (
  "id" serial PRIMARY KEY NOT NULL,
  "community_id" integer NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "type" text DEFAULT 'text' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "community_channels_community_id_communities_id_fk"
    FOREIGN KEY ("community_id") REFERENCES "communities"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "community_messages" (
  "id" serial PRIMARY KEY NOT NULL,
  "channel_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "content" text NOT NULL,
  "media_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "community_messages_channel_id_community_channels_id_fk"
    FOREIGN KEY ("channel_id") REFERENCES "community_channels"("id") ON DELETE cascade,
  CONSTRAINT "community_messages_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_community_members_role') THEN
    ALTER TABLE "community_members"
      ADD CONSTRAINT "ck_community_members_role"
      CHECK ("role" IN ('owner', 'admin', 'member'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ck_community_channels_type') THEN
    ALTER TABLE "community_channels"
      ADD CONSTRAINT "ck_community_channels_type"
      CHECK ("type" IN ('text', 'announcement'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "communities_public_idx" ON "communities" ("is_public");
CREATE INDEX IF NOT EXISTS "communities_creator_idx" ON "communities" ("creator_id");
CREATE INDEX IF NOT EXISTS "community_members_community_idx" ON "community_members" ("community_id");
CREATE INDEX IF NOT EXISTS "community_members_user_idx" ON "community_members" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "community_members_unique" ON "community_members" ("community_id", "user_id");
CREATE INDEX IF NOT EXISTS "community_channels_community_idx" ON "community_channels" ("community_id");
CREATE INDEX IF NOT EXISTS "community_messages_channel_idx" ON "community_messages" ("channel_id");
CREATE INDEX IF NOT EXISTS "community_messages_user_idx" ON "community_messages" ("user_id");
CREATE INDEX IF NOT EXISTS "community_messages_created_at_idx" ON "community_messages" ("created_at");
