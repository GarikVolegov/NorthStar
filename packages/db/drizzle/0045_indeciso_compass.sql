-- 0045_indeciso_compass.sql — "La Bussola" del percorso indeciso (Fase 1).
-- Tabelle: compass_profiles, compass_signals, scene_cards.
--
-- Recuperata dal deploy live (commit 9c9a450, era 0052 su quella linea) e
-- rinumerata 0045 (prossimo libero su release/launch-candidate, ferma a 0044).
-- Scritta a mano e IDEMPOTENTE (pattern delle 0035–0044): il journal Drizzle è
-- in drift noto (idx 34, memoria.md §8), quindi NON usare `drizzle-kit generate`.
-- In dev/test lo schema si costruisce via `drizzle-kit push` (dal TS); questo
-- file serve a `db:migrate` (staging/prod), dove va riconciliato nel journal.
-- In coda c'è un seed IDEMPOTENTE del deck iniziale dello "Specchio" (scene_cards
-- con pesi RIASEC, usati da POST /api/compass/signal): si applica solo se la
-- tabella è vuota. NB: `drizzle-kit push` NON esegue questo file → su un DB
-- push-based il seed va lanciato a parte (stessa INSERT).

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

-- ── Seed iniziale del deck "Lo Specchio" (idempotente: solo se vuoto) ───────
INSERT INTO "scene_cards" ("prompt", "riasec_weights", "tags")
SELECT v.prompt, v.weights::jsonb, v.tags::text[]
FROM (VALUES
  ('Passi un pomeriggio a capire perché un meccanismo non funziona, finché non lo aggiusti.', '{"R":0.8,"I":0.6}', '{mani,problem-solving}'),
  ('Disegni l''interfaccia di un''app su un foglio, immaginando chi la userà.', '{"A":0.7,"I":0.4,"E":0.3}', '{design,prodotto}'),
  ('Spieghi a qualcuno un concetto difficile finché non si illumina.', '{"S":0.8,"I":0.4}', '{insegnare,relazioni}'),
  ('Metti in ordine un foglio di calcolo e ti dà soddisfazione vederlo pulito.', '{"C":0.8,"E":0.2}', '{ordine,dati}'),
  ('Convinci un gruppo indeciso a provare la tua idea.', '{"E":0.8,"S":0.5}', '{leadership,persuasione}'),
  ('Ti perdi per ore a capire come funziona un fenomeno, solo per il gusto di saperlo.', '{"I":0.9,"A":0.2}', '{ricerca,curiosita}'),
  ('Scrivi di getto e il tempo vola.', '{"A":0.9,"S":0.2}', '{scrittura,creativita}'),
  ('Aggiusti qualcosa con le mani e ti piace il risultato concreto.', '{"R":0.8,"S":0.3}', '{mani,concreto}')
) AS v(prompt, weights, tags)
WHERE NOT EXISTS (SELECT 1 FROM "scene_cards");
