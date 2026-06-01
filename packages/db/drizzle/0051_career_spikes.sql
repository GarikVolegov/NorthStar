-- 0051_career_spikes.sql — "Spike di carriera": commit reversibile dell'indeciso.
-- Tabella: career_spikes (micro-esperimento 2 settimane con kill-criterion).
--
-- NOTA: scritta a mano e idempotente (pattern 0050_indeciso_compass.sql) perché
-- `pnpm db:generate` su questo branch è bloccato da drift di journal PREESISTENTE
-- non correlato a questa feature. Resta applicabile senza danni; quando il drift
-- sarà risolto, rigenerare con `pnpm db:generate` per riallineare snapshot.

CREATE TABLE IF NOT EXISTS "career_spikes" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "hypothesis_label" text NOT NULL,
  "ref_type" text,
  "ref_id" text,
  "action" text NOT NULL,
  "kill_criterion" text NOT NULL,
  "start_date" timestamp with time zone DEFAULT now() NOT NULL,
  "review_date" timestamp with time zone NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "outcome" jsonb,
  "objective_id" integer,
  "calendar_event_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "career_spikes"
    ADD CONSTRAINT "career_spikes_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "career_spikes_user_idx" ON "career_spikes" ("user_id");
CREATE INDEX IF NOT EXISTS "career_spikes_status_idx" ON "career_spikes" ("status");
