-- 0050_indeciso_compass.sql — "La Bussola" del percorso indeciso.
-- Tabelle: compass_profiles, compass_signals, scene_cards.
--
-- NOTA: scritta a mano e idempotente (pattern 0046_simulated_days.sql) perché
-- `pnpm db:generate` su questo branch è bloccato da drift di journal PREESISTENTE
-- (duplice 0049_*, rename pending user_profile_settings) non correlato a questa
-- feature. Quando il drift sarà risolto, rigenerare con `pnpm db:generate` per
-- riallineare _journal.json/snapshot; questo file resta applicabile senza danni.

-- ── compass_profiles (1 riga per utente) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "compass_profiles" (
  "user_id" integer PRIMARY KEY NOT NULL,
  "block_type" text DEFAULT 'unknown' NOT NULL,
  "revealed_riasec" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "energy_profile" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "hypotheses" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "stage" text DEFAULT 'zero_ideas' NOT NULL,
  "signal_count" integer DEFAULT 0 NOT NULL,
  "direction_confidence" real DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "compass_profiles"
    ADD CONSTRAINT "compass_profiles_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ── compass_signals (stream append-only) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS "compass_signals" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL,
  "signal_type" text NOT NULL,
  "ref_type" text,
  "ref_id" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "weight" real DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "compass_signals"
    ADD CONSTRAINT "compass_signals_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "compass_signals_user_idx" ON "compass_signals" ("user_id");
CREATE INDEX IF NOT EXISTS "compass_signals_type_idx" ON "compass_signals" ("signal_type");
CREATE INDEX IF NOT EXISTS "compass_signals_user_created_idx" ON "compass_signals" ("user_id", "created_at");

-- ── scene_cards (contenuto deck "Lo Specchio", no PII) ──────────────────────
CREATE TABLE IF NOT EXISTS "scene_cards" (
  "id" serial PRIMARY KEY NOT NULL,
  "prompt" text NOT NULL,
  "image_url" text,
  "riasec_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "linked_sector_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "linked_role_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "scene_cards_active_idx" ON "scene_cards" ("active");
