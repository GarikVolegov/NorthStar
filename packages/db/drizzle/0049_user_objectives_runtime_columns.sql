ALTER TABLE "user_objectives"
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "is_certifiable_milestone" boolean DEFAULT false NOT NULL;
