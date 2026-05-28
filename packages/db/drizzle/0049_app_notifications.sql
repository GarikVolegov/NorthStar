CREATE TABLE IF NOT EXISTS "app_notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
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
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "app_notifications_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id" serial PRIMARY KEY NOT NULL,
  "notification_id" integer NOT NULL,
  "channel" text DEFAULT 'in_app' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_deliveries_notification_id_app_notifications_id_fk"
    FOREIGN KEY ("notification_id") REFERENCES "app_notifications"("id") ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "user_id" integer PRIMARY KEY NOT NULL,
  "in_app_enabled" boolean DEFAULT true NOT NULL,
  "push_enabled" boolean DEFAULT true NOT NULL,
  "email_enabled" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "notification_preferences_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "app_notifications_user_created_idx"
  ON "app_notifications" ("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "app_notifications_user_unread_idx"
  ON "app_notifications" ("user_id", "read_at");
CREATE INDEX IF NOT EXISTS "app_notifications_source_idx"
  ON "app_notifications" ("source");
CREATE UNIQUE INDEX IF NOT EXISTS "app_notifications_user_dedupe_unique"
  ON "app_notifications" ("user_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "notification_deliveries_notification_channel_idx"
  ON "notification_deliveries" ("notification_id", "channel");
CREATE INDEX IF NOT EXISTS "notification_preferences_push_enabled_idx"
  ON "notification_preferences" ("push_enabled");
CREATE INDEX IF NOT EXISTS "notification_preferences_email_enabled_idx"
  ON "notification_preferences" ("email_enabled");

DO $$
BEGIN
  IF to_regclass('public.push_subscriptions') IS NOT NULL THEN
    EXECUTE $copy$
      INSERT INTO "user_push_subscriptions" ("user_id", "endpoint", "p256dh", "auth", "created_at", "updated_at")
      SELECT DISTINCT ON ("endpoint") "user_id", "endpoint", "p256dh", "auth", "created_at", now()
      FROM "push_subscriptions"
      ORDER BY "endpoint", "created_at" DESC
      ON CONFLICT ("endpoint") DO NOTHING
    $copy$;
  END IF;
END $$;
