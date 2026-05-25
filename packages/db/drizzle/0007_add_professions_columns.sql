ALTER TABLE "professions" ADD COLUMN IF NOT EXISTS "sector_id" integer REFERENCES "sectors"("id");
--> statement-breakpoint
ALTER TABLE "professions" ADD COLUMN IF NOT EXISTS "description" text;
--> statement-breakpoint
ALTER TABLE "professions" ADD COLUMN IF NOT EXISTS "autonomy_score" integer DEFAULT 5;
--> statement-breakpoint
ALTER TABLE "professions" ADD COLUMN IF NOT EXISTS "stability_score" integer DEFAULT 5;
