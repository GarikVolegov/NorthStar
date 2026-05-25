CREATE TABLE IF NOT EXISTS "voice_sessions" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'ongoing',
  "duration_seconds" integer,
  "xp_awarded" integer NOT NULL DEFAULT 0,
  "counted_for_streak" boolean NOT NULL DEFAULT false,
  "summary" text,
  "agent_type" text,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_sessions_user_idx" ON "voice_sessions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_sessions_user_status_idx" ON "voice_sessions" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "voice_sessions_started_at_idx" ON "voice_sessions" ("started_at");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "chat_messages" (
  "id" serial PRIMARY KEY,
  "friendship_id" integer NOT NULL REFERENCES "friendships"("id") ON DELETE CASCADE,
  "sender_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "encrypted_content" text NOT NULL,
  "iv" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "read_at" timestamptz
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_keys" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "public_key" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "friendship_keys" (
  "friendship_id" integer NOT NULL REFERENCES "friendships"("id") ON DELETE CASCADE,
  "key_for_requester" text NOT NULL,
  "key_for_receiver" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("friendship_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "profession_education_paths" (
  "id" serial PRIMARY KEY,
  "profession_id" integer NOT NULL REFERENCES "professions"("id") ON DELETE CASCADE,
  "education_path_id" integer NOT NULL REFERENCES "education_paths"("id") ON DELETE CASCADE,
  "relevance" text
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_nodes" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" varchar(32) NOT NULL DEFAULT 'document',
  "title" varchar(200) NOT NULL,
  "content" text NOT NULL DEFAULT '',
  "color" varchar(16),
  "url" text,
  "sector_id" integer,
  "x" real NOT NULL DEFAULT 0,
  "y" real NOT NULL DEFAULT 0,
  "embedding" jsonb,
  "embedded_text" text,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_nodes_user_idx" ON "knowledge_nodes" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_nodes_type_idx" ON "knowledge_nodes" ("type");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "knowledge_edges" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "source_id" integer NOT NULL REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE,
  "target_id" integer NOT NULL REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "confidence" real NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_edges_user_idx" ON "knowledge_edges" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_edges_source_idx" ON "knowledge_edges" ("source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "knowledge_edges_target_idx" ON "knowledge_edges" ("target_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "knowledge_edges_unique" ON "knowledge_edges" ("user_id", "source_id", "target_id", "label");
--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "voice_streak" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "total_xp" integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_voice_session_at" timestamptz;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "user_badges" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "badge_key" text NOT NULL,
  "badge_label" text NOT NULL,
  "badge_icon" text NOT NULL,
  "badge_description" text,
  "xp_awarded" integer NOT NULL DEFAULT 0,
  "earned_at" timestamptz NOT NULL DEFAULT now(),
  "seen" boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_badges_user_idx" ON "user_badges" ("user_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "weekly_leaderboard" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "week_start" timestamptz NOT NULL,
  "week_end" timestamptz NOT NULL,
  "xp_earned" integer NOT NULL DEFAULT 0,
  "sessions_completed" integer NOT NULL DEFAULT 0,
  "rank" integer,
  "prize_awarded" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "weekly_lb_week_user_idx" ON "weekly_leaderboard" ("week_start", "user_id");
