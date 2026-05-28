-- Migration 0047 — Fase 1: Ritual Engine + Dashboard Personalizzabile
-- Crea le tabelle per l'infrastruttura AaaS:
--   user_routines         → routine autonome configurate dall'utente
--   routine_executions    → storico risultati esecuzioni (feed in-app)
--   user_dashboard_layout → layout widget dashboard personalizzabile

-- ── user_routines ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_routines" (
  "id"             serial PRIMARY KEY,
  "user_id"        integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"           text NOT NULL
                     CHECK ("type" IN (
                       'job_monitor', 'market_report', 'mindset_exercise',
                       'growth_briefing', 'interview_prep'
                     )),
  "name"           text NOT NULL,
  "schedule"       text NOT NULL,
  "parameters"     jsonb NOT NULL DEFAULT '{}',
  "output_channel" text NOT NULL DEFAULT 'all'
                     CHECK ("output_channel" IN ('email', 'in_app', 'wendy_context', 'all')),
  "active"         boolean NOT NULL DEFAULT true,
  "last_run_at"    timestamp with time zone,
  "next_run_at"    timestamp with time zone,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_routines_user_idx"
  ON "user_routines" ("user_id");

-- Indice principale usato dal worker: trova routine attive in scadenza
CREATE INDEX IF NOT EXISTS "user_routines_active_next_idx"
  ON "user_routines" ("active", "next_run_at");

CREATE INDEX IF NOT EXISTS "user_routines_type_idx"
  ON "user_routines" ("type");

-- ── routine_executions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "routine_executions" (
  "id"          serial PRIMARY KEY,
  "routine_id"  integer NOT NULL REFERENCES "user_routines"("id") ON DELETE CASCADE,
  "user_id"     integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title"       text NOT NULL,
  "body"        text NOT NULL,
  "cta_label"   text,
  "cta_target"  text,
  "metadata"    jsonb,
  "read_at"     timestamp with time zone,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "routine_executions_user_idx"
  ON "routine_executions" ("user_id");

CREATE INDEX IF NOT EXISTS "routine_executions_routine_idx"
  ON "routine_executions" ("routine_id");

-- Indice per il feed in-app (ultimi risultati per utente)
CREATE INDEX IF NOT EXISTS "routine_executions_feed_idx"
  ON "routine_executions" ("user_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "routine_executions_unread_idx"
  ON "routine_executions" ("user_id", "read_at");

-- ── user_dashboard_layout ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_dashboard_layout" (
  "user_id"    integer PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
  "layout"     jsonb NOT NULL DEFAULT '[]',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "user_dashboard_layout_user_idx"
  ON "user_dashboard_layout" ("user_id");
