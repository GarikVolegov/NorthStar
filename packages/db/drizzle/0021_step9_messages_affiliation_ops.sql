ALTER TABLE "contact_messages"
ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'new',
ADD COLUMN IF NOT EXISTS "internal_notes" text,
ADD COLUMN IF NOT EXISTS "assigned_to" integer REFERENCES "users"("id") ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

ALTER TABLE "contact_messages"
DROP CONSTRAINT IF EXISTS "contact_messages_status_check";

ALTER TABLE "contact_messages"
ADD CONSTRAINT "contact_messages_status_check"
CHECK ("status" IN ('new', 'in_progress', 'resolved', 'archived'));

UPDATE "contact_messages"
SET "read_at" = COALESCE("read_at", "created_at")
WHERE "read" = true AND "read_at" IS NULL;

CREATE INDEX IF NOT EXISTS "contact_messages_read_idx"
  ON "contact_messages" ("read");

CREATE INDEX IF NOT EXISTS "contact_messages_status_idx"
  ON "contact_messages" ("status");

CREATE INDEX IF NOT EXISTS "contact_messages_assigned_to_idx"
  ON "contact_messages" ("assigned_to");

CREATE INDEX IF NOT EXISTS "contact_messages_created_at_idx"
  ON "contact_messages" ("created_at");

ALTER TABLE "affiliation_leads"
ADD COLUMN IF NOT EXISTS "read" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "read_at" timestamp with time zone,
ADD COLUMN IF NOT EXISTS "internal_notes" text,
ADD COLUMN IF NOT EXISTS "assigned_to" integer REFERENCES "users"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "affiliation_leads_status_idx"
  ON "affiliation_leads" ("status");

CREATE INDEX IF NOT EXISTS "affiliation_leads_read_idx"
  ON "affiliation_leads" ("read");

CREATE INDEX IF NOT EXISTS "affiliation_leads_assigned_to_idx"
  ON "affiliation_leads" ("assigned_to");

CREATE INDEX IF NOT EXISTS "affiliation_leads_created_at_idx"
  ON "affiliation_leads" ("created_at");
