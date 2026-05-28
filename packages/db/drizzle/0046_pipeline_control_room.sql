CREATE TABLE IF NOT EXISTS "pipeline_runs" (
  "id" serial PRIMARY KEY,
  "template_id" text NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "requested_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_json" jsonb,
  "error_message" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_pipeline_runs_status"
    CHECK ("status" IN ('queued', 'running', 'blocked', 'completed', 'failed', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS "pipeline_steps" (
  "id" serial PRIMARY KEY,
  "run_id" integer NOT NULL REFERENCES "pipeline_runs"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "title" text NOT NULL,
  "agent_key" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "risk" text DEFAULT 'low' NOT NULL,
  "requires_confirmation" boolean DEFAULT false NOT NULL,
  "depends_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "input_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "output_json" jsonb,
  "retry_count" integer DEFAULT 0 NOT NULL,
  "error_message" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "confirmed_at" timestamp with time zone,
  "confirmed_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_pipeline_steps_status"
    CHECK ("status" IN ('pending', 'ready', 'running', 'needs_confirmation', 'completed', 'failed', 'skipped', 'cancelled')),
  CONSTRAINT "ck_pipeline_steps_risk"
    CHECK ("risk" IN ('low', 'medium', 'high'))
);

CREATE INDEX IF NOT EXISTS "pipeline_runs_status_idx"
  ON "pipeline_runs" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "pipeline_runs_requested_by_idx"
  ON "pipeline_runs" ("requested_by");
CREATE INDEX IF NOT EXISTS "pipeline_runs_template_idx"
  ON "pipeline_runs" ("template_id", "created_at");
CREATE INDEX IF NOT EXISTS "pipeline_steps_run_idx"
  ON "pipeline_steps" ("run_id");
CREATE INDEX IF NOT EXISTS "pipeline_steps_status_idx"
  ON "pipeline_steps" ("status", "updated_at");
CREATE INDEX IF NOT EXISTS "pipeline_steps_run_key_idx"
  ON "pipeline_steps" ("run_id", "key");
