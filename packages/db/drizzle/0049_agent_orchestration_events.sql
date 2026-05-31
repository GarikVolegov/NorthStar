CREATE TABLE IF NOT EXISTS "agent_orchestration_events" (
  "id" serial PRIMARY KEY,
  "user_id" integer,
  "source" text NOT NULL,
  "trigger_type" text NOT NULL,
  "decision" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "status" text DEFAULT 'planned' NOT NULL,
  "input_summary" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ck_agent_orchestration_events_status"
    CHECK ("status" IN ('planned', 'dispatched', 'completed', 'failed'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "agent_orchestration_events"
    ADD CONSTRAINT "agent_orchestration_events_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_orchestration_events_user_created"
  ON "agent_orchestration_events" ("user_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_orchestration_events_status"
  ON "agent_orchestration_events" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_orchestration_events_target"
  ON "agent_orchestration_events" ("target_type", "target_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_orchestration_events_decision"
  ON "agent_orchestration_events" ("decision");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_set_updated_at" ON "agent_orchestration_events";
--> statement-breakpoint
CREATE TRIGGER "trg_set_updated_at"
  BEFORE UPDATE ON "agent_orchestration_events"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
