-- Add dependent career path steps to sectors table
ALTER TABLE "sectors"
  ADD COLUMN IF NOT EXISTS "dipendenti_steps" json DEFAULT '[]'::json;
