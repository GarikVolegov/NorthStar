CREATE TABLE IF NOT EXISTS "user_psychological_profile" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "ocean_openness" real,
  "ocean_conscientiousness" real,
  "ocean_extraversion" real,
  "ocean_agreeableness" real,
  "ocean_neuroticism" real,
  "ocean_source" text,
  "ocean_confidence" real DEFAULT 0,
  "decision_style" text,
  "risk_tolerance" text,
  "communication_style" text,
  "chronotype" text,
  "chronotype_confidence" real DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  CONSTRAINT "ck_user_psychological_profile_ocean_source"
    CHECK ("ocean_source" IS NULL OR "ocean_source" IN ('explicit', 'inferred', 'hybrid')),
  CONSTRAINT "ck_user_psychological_profile_decision_style"
    CHECK ("decision_style" IS NULL OR "decision_style" IN ('analytical', 'directive', 'intuitive', 'collaborative')),
  CONSTRAINT "ck_user_psychological_profile_risk_tolerance"
    CHECK ("risk_tolerance" IS NULL OR "risk_tolerance" IN ('conservative', 'moderate', 'bold')),
  CONSTRAINT "ck_user_psychological_profile_communication_style"
    CHECK ("communication_style" IS NULL OR "communication_style" IN ('concise', 'detailed', 'visual', 'narrative')),
  CONSTRAINT "ck_user_psychological_profile_chronotype"
    CHECK ("chronotype" IS NULL OR "chronotype" IN ('morning', 'intermediate', 'evening'))
);

CREATE TABLE IF NOT EXISTS "user_motivational_profile" (
  "user_id" integer PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "need_autonomy" real DEFAULT 0.33,
  "need_competence" real DEFAULT 0.33,
  "need_relatedness" real DEFAULT 0.33,
  "need_achievement" real DEFAULT 0.33,
  "need_affiliation" real DEFAULT 0.33,
  "need_power" real DEFAULT 0.33,
  "value_self_direction" real DEFAULT 0,
  "value_stimulation" real DEFAULT 0,
  "value_hedonism" real DEFAULT 0,
  "value_achievement" real DEFAULT 0,
  "value_power" real DEFAULT 0,
  "value_security" real DEFAULT 0,
  "value_conformity" real DEFAULT 0,
  "value_tradition" real DEFAULT 0,
  "value_benevolence" real DEFAULT 0,
  "value_universalism" real DEFAULT 0,
  "primary_values" jsonb DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "user_behavioral_signals" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "week_start" date NOT NULL,
  "peak_hour_start" integer,
  "peak_hour_end" integer,
  "avg_response_latency_ms" integer,
  "avg_session_minutes" real,
  "top_domains" jsonb DEFAULT '[]'::jsonb,
  "streak_consistency" real DEFAULT 0,
  "goal_completion_rate" real DEFAULT 0,
  "explore_vs_focus_ratio" real DEFAULT 0.5,
  "question_vs_statement" real DEFAULT 0,
  "negative_emotion_words" real DEFAULT 0,
  "uncertainty_markers" real DEFAULT 0,
  "social_word_usage" real DEFAULT 0,
  "future_temporal_focus" real DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  PRIMARY KEY ("user_id", "week_start")
);

CREATE TABLE IF NOT EXISTS "user_profiling_consents" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "dimension" text NOT NULL,
  "granted" boolean DEFAULT false NOT NULL,
  "granted_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone,
  PRIMARY KEY ("user_id", "dimension"),
  CONSTRAINT "ck_user_profiling_consents_dimension"
    CHECK ("dimension" IN ('big_five', 'values', 'motivation', 'linguistic', 'behavioral_passive', 'chronotype'))
);

CREATE INDEX IF NOT EXISTS "user_behavioral_signals_user_idx"
  ON "user_behavioral_signals" ("user_id");
CREATE INDEX IF NOT EXISTS "user_behavioral_signals_week_idx"
  ON "user_behavioral_signals" ("week_start");
CREATE INDEX IF NOT EXISTS "user_profiling_consents_user_idx"
  ON "user_profiling_consents" ("user_id");
CREATE INDEX IF NOT EXISTS "user_profiling_consents_dimension_idx"
  ON "user_profiling_consents" ("dimension");

ALTER TABLE "user_psychological_profile"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "user_motivational_profile"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "user_behavioral_signals"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
ALTER TABLE "user_profiling_consents"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
