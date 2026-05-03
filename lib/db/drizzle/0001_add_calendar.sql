ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" text DEFAULT 'Europe/Rome';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "calendar_events" (
"id" serial PRIMARY KEY NOT NULL,
"user_id" integer NOT NULL,
"title" text NOT NULL,
"description" text,
"start_at" timestamp with time zone NOT NULL,
"end_at" timestamp with time zone NOT NULL,
"all_day" boolean DEFAULT false NOT NULL,
"category" text DEFAULT 'task' NOT NULL,
"priority" text DEFAULT 'medium' NOT NULL,
"status" text DEFAULT 'todo' NOT NULL,
"color" text,
"tags" jsonb DEFAULT '[]'::jsonb,
"linked_sector_id" integer,
"linked_goal" text,
"linked_content_ids" jsonb DEFAULT '[]'::jsonb,
"is_recurring" boolean DEFAULT false NOT NULL,
"recurrence_rule" text,
"created_at" timestamp with time zone DEFAULT now() NOT NULL,
"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_reminders" (
"id" serial PRIMARY KEY NOT NULL,
"event_id" integer NOT NULL,
"minutes_before" integer NOT NULL,
"enabled" boolean DEFAULT true NOT NULL,
"sent_at" timestamp with time zone,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications_log" (
"id" serial PRIMARY KEY NOT NULL,
"user_id" integer NOT NULL,
"event_id" integer,
"channel" text DEFAULT 'inapp' NOT NULL,
"title" text NOT NULL,
"body" text,
"is_read" boolean DEFAULT false NOT NULL,
"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
"opened_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
"id" serial PRIMARY KEY NOT NULL,
"user_id" integer NOT NULL,
"endpoint" text NOT NULL,
"p256dh" text NOT NULL,
"auth" text NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'calendar_events_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "calendar_events" ADD CONSTRAINT "calendar_events_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'event_reminders_event_id_calendar_events_id_fk'
  ) THEN
    ALTER TABLE "event_reminders" ADD CONSTRAINT "event_reminders_event_id_calendar_events_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_log_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notifications_log_event_id_calendar_events_id_fk'
  ) THEN
    ALTER TABLE "notifications_log" ADD CONSTRAINT "notifications_log_event_id_calendar_events_id_fk"
      FOREIGN KEY ("event_id") REFERENCES "public"."calendar_events"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'push_subscriptions_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
