CREATE TABLE IF NOT EXISTS "user_navigation_preferences" (
  "user_id" integer PRIMARY KEY NOT NULL,
  "top_nav_layout" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "user_navigation_preferences_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS "user_navigation_preferences_user_idx"
  ON "user_navigation_preferences" ("user_id");
