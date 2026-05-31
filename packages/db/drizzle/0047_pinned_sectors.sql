CREATE TABLE IF NOT EXISTS "pinned_sectors" (
  "user_id" integer NOT NULL,
  "sector_id" integer NOT NULL,
  "pinned_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "sector_id")
);

DO $$ BEGIN
  ALTER TABLE "pinned_sectors"
    ADD CONSTRAINT "pinned_sectors_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pinned_sectors"
    ADD CONSTRAINT "pinned_sectors_sector_id_sectors_id_fk"
    FOREIGN KEY ("sector_id") REFERENCES "sectors"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "pinned_sectors_sector_idx"
  ON "pinned_sectors" ("sector_id");
