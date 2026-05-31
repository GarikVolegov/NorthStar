ALTER TABLE "user_objectives"
  ADD COLUMN IF NOT EXISTS "is_certifiable_milestone" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_nft_certificates_user_objective_unique"
  ON "nft_certificates" ("user_id", "objective_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_nft_certificates_public_hash"
  ON "nft_certificates" ("certificate_hash")
  WHERE "is_public" = true;
