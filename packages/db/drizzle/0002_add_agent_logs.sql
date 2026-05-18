CREATE TABLE IF NOT EXISTS "agent_logs" (
"id" serial PRIMARY KEY NOT NULL,
"agent_name" text NOT NULL,
"user_id" integer,
"task_type" text NOT NULL,
"input_summary" jsonb,
"output_summary" jsonb,
"duration_ms" integer,
"error" text,
"retry_count" integer DEFAULT 0 NOT NULL,
"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
