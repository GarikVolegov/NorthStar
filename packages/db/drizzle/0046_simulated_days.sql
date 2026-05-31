CREATE TABLE IF NOT EXISTS "simulated_days" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "profession_id" integer NOT NULL,
  "role_title" text NOT NULL,
  "sector" text NOT NULL,
  "scenes_json" jsonb NOT NULL,
  "responses_json" jsonb,
  "debrief_json" jsonb,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "simulated_days"
    ADD CONSTRAINT "simulated_days_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "simulated_days"
    ADD CONSTRAINT "simulated_days_profession_id_professions_id_fk"
    FOREIGN KEY ("profession_id") REFERENCES "professions"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "simulated_days_user_profession_created_idx"
  ON "simulated_days" ("user_id", "profession_id", "created_at");

CREATE INDEX IF NOT EXISTS "simulated_days_user_completed_idx"
  ON "simulated_days" ("user_id", "completed_at");
