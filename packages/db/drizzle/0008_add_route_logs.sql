CREATE TABLE IF NOT EXISTS "route_logs" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message" text NOT NULL,
  "message_hash" varchar(12) NOT NULL,
  "domain" varchar(20) NOT NULL,
  "intent" varchar(20) NOT NULL,
  "confidence" real NOT NULL,
  "threshold" real NOT NULL,
  "reasoning" text,
  "is_fallback" boolean NOT NULL DEFAULT false,
  "fallback_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "route_logs_user_idx" ON "route_logs" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "route_logs_created_at_idx" ON "route_logs" ("created_at");
