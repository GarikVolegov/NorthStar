CREATE TABLE IF NOT EXISTS "diary_entries" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "mood" text,
  "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "entry_type" text NOT NULL DEFAULT 'free',
  "prompt_payload" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_diary_entries_mood"
    CHECK ("mood" IS NULL OR "mood" IN ('ottimo', 'bene', 'neutro', 'difficile', 'critico')),
  CONSTRAINT "ck_diary_entries_type"
    CHECK ("entry_type" IN ('free', 'indizi'))
);

ALTER TABLE "diary_entries" ADD COLUMN IF NOT EXISTS "entry_type" text NOT NULL DEFAULT 'free';
ALTER TABLE "diary_entries" ADD COLUMN IF NOT EXISTS "prompt_payload" jsonb;

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

CREATE TABLE IF NOT EXISTS "user_routines" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL CHECK ("type" IN ('job_monitor', 'market_report', 'mindset_exercise', 'growth_briefing', 'interview_prep')),
  "name" text NOT NULL,
  "schedule" text NOT NULL,
  "parameters" jsonb NOT NULL DEFAULT '{}',
  "output_channel" text NOT NULL DEFAULT 'all' CHECK ("output_channel" IN ('email', 'in_app', 'wendy_context', 'all')),
  "active" boolean NOT NULL DEFAULT true,
  "last_run_at" timestamp with time zone,
  "next_run_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "routine_executions" (
  "id" serial PRIMARY KEY,
  "routine_id" integer NOT NULL REFERENCES "user_routines"("id") ON DELETE CASCADE,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "cta_label" text,
  "cta_target" text,
  "metadata" jsonb,
  "read_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "user_dashboard_layout" (
  "user_id" integer PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "layout" jsonb NOT NULL DEFAULT '[]',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "monthly_ritual_preferences" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "ritual_enabled" boolean DEFAULT true NOT NULL,
  "email_reminder_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "monthly_ritual_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "ritual_month" text NOT NULL,
  "ritual_date" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "journey_type" text NOT NULL,
  "route_title" text NOT NULL,
  "route_body" text NOT NULL,
  "challenge_key" text NOT NULL,
  "challenge_label" text NOT NULL,
  "challenge_body" text NOT NULL,
  "cta_label" text NOT NULL,
  "cta_target" text NOT NULL,
  "email_sent_at" timestamp with time zone,
  "push_sent_at" timestamp with time zone,
  "proactive_insight_created_at" timestamp with time zone,
  "opened_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_push_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "app_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "source" text NOT NULL,
  "type" text NOT NULL,
  "severity" text DEFAULT 'info' NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "cta_label" text,
  "cta_url" text,
  "icon_key" text DEFAULT 'bell' NOT NULL,
  "dedupe_key" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "read_at" timestamp with time zone,
  "opened_at" timestamp with time zone,
  "dismissed_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "notification_id" integer NOT NULL REFERENCES "app_notifications"("id") ON DELETE cascade,
  "channel" text DEFAULT 'in_app' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "in_app_enabled" boolean DEFAULT true NOT NULL,
  "push_enabled" boolean DEFAULT true NOT NULL,
  "email_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_navigation_preferences" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "top_nav_layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE user_profile_settings
  ADD COLUMN IF NOT EXISTS active_logo_preset text NOT NULL DEFAULT 'northstar';

CREATE INDEX IF NOT EXISTS "diary_entries_user_created_at_idx" ON "diary_entries" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "diary_entries_user_type_idx" ON "diary_entries" ("user_id", "entry_type");
CREATE INDEX IF NOT EXISTS "diary_ideas_user_created_at_idx" ON "diary_ideas" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "diary_ideas_user_completed_idx" ON "diary_ideas" ("user_id", "completed");
CREATE INDEX IF NOT EXISTS "investor_analyses_user_created_at_idx" ON "investor_analyses" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "investor_analyses_sector_idx" ON "investor_analyses" ("sector_id");
CREATE INDEX IF NOT EXISTS "user_routines_user_idx" ON "user_routines" ("user_id");
CREATE INDEX IF NOT EXISTS "user_routines_active_next_idx" ON "user_routines" ("active", "next_run_at");
CREATE INDEX IF NOT EXISTS "user_routines_type_idx" ON "user_routines" ("type");
CREATE INDEX IF NOT EXISTS "routine_executions_user_idx" ON "routine_executions" ("user_id");
CREATE INDEX IF NOT EXISTS "routine_executions_routine_idx" ON "routine_executions" ("routine_id");
CREATE INDEX IF NOT EXISTS "routine_executions_feed_idx" ON "routine_executions" ("user_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "routine_executions_unread_idx" ON "routine_executions" ("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "user_dashboard_layout_user_idx" ON "user_dashboard_layout" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "monthly_ritual_runs_user_month_unique" ON "monthly_ritual_runs" ("user_id", "ritual_month");
CREATE INDEX IF NOT EXISTS "monthly_ritual_runs_user_idx" ON "monthly_ritual_runs" ("user_id");
CREATE INDEX IF NOT EXISTS "monthly_ritual_runs_month_idx" ON "monthly_ritual_runs" ("ritual_month");
CREATE INDEX IF NOT EXISTS "monthly_ritual_runs_status_idx" ON "monthly_ritual_runs" ("status");
CREATE INDEX IF NOT EXISTS "monthly_ritual_preferences_enabled_idx" ON "monthly_ritual_preferences" ("ritual_enabled");
CREATE UNIQUE INDEX IF NOT EXISTS "user_push_subscriptions_endpoint_unique" ON "user_push_subscriptions" ("endpoint");
CREATE INDEX IF NOT EXISTS "user_push_subscriptions_user_idx" ON "user_push_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "user_push_subscriptions_active_user_idx" ON "user_push_subscriptions" ("user_id", "revoked_at");
CREATE INDEX IF NOT EXISTS "app_notifications_user_created_idx" ON "app_notifications" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "app_notifications_user_unread_idx" ON "app_notifications" ("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "app_notifications_source_idx" ON "app_notifications" ("source");
CREATE UNIQUE INDEX IF NOT EXISTS "app_notifications_user_dedupe_unique" ON "app_notifications" ("user_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "notification_deliveries_notification_channel_idx" ON "notification_deliveries" ("notification_id", "channel");
CREATE INDEX IF NOT EXISTS "notification_preferences_push_enabled_idx" ON "notification_preferences" ("push_enabled");
CREATE INDEX IF NOT EXISTS "notification_preferences_email_enabled_idx" ON "notification_preferences" ("email_enabled");
CREATE INDEX IF NOT EXISTS "user_navigation_preferences_user_idx" ON "user_navigation_preferences" ("user_id");
