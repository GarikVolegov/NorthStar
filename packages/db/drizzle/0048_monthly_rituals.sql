CREATE TABLE IF NOT EXISTS "monthly_ritual_preferences" (
  "user_id" integer PRIMARY KEY NOT NULL,
  "ritual_enabled" boolean DEFAULT true NOT NULL,
  "email_reminder_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "monthly_ritual_preferences_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "monthly_ritual_runs" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
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
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "monthly_ritual_runs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "user_push_subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "endpoint" text NOT NULL,
  "p256dh" text NOT NULL,
  "auth" text NOT NULL,
  "user_agent" text,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_push_subscriptions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "monthly_ritual_runs_user_month_unique"
  ON "monthly_ritual_runs" ("user_id", "ritual_month");
CREATE INDEX IF NOT EXISTS "monthly_ritual_runs_user_idx"
  ON "monthly_ritual_runs" ("user_id");
CREATE INDEX IF NOT EXISTS "monthly_ritual_runs_month_idx"
  ON "monthly_ritual_runs" ("ritual_month");
CREATE INDEX IF NOT EXISTS "monthly_ritual_runs_status_idx"
  ON "monthly_ritual_runs" ("status");
CREATE INDEX IF NOT EXISTS "monthly_ritual_preferences_enabled_idx"
  ON "monthly_ritual_preferences" ("ritual_enabled");
CREATE UNIQUE INDEX IF NOT EXISTS "user_push_subscriptions_endpoint_unique"
  ON "user_push_subscriptions" ("endpoint");
CREATE INDEX IF NOT EXISTS "user_push_subscriptions_user_idx"
  ON "user_push_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "user_push_subscriptions_active_user_idx"
  ON "user_push_subscriptions" ("user_id", "revoked_at");
