CREATE TABLE IF NOT EXISTS "professions" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "sector" text NOT NULL,
  "riasec_fit" text[] NOT NULL DEFAULT '{}',
  "skills" text[] NOT NULL DEFAULT '{}',
  "work_modes" text[] NOT NULL DEFAULT '{}',
  "salary_range" text NOT NULL,
  "growth_outlook" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "education_paths" (
  "id" serial PRIMARY KEY,
  "path" text NOT NULL,
  "type" text NOT NULL,
  "duration" text NOT NULL,
  "cost" text NOT NULL,
  "steps" text[] NOT NULL DEFAULT '{}',
  "career_outcomes" text[] NOT NULL DEFAULT '{}',
  "sector_fit" text[] NOT NULL DEFAULT '{}',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
