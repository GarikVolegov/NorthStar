ALTER TABLE user_profile_settings
  ADD COLUMN IF NOT EXISTS active_background_id TEXT;

ALTER TABLE user_profile_settings
  ADD COLUMN IF NOT EXISTS background_library JSONB DEFAULT '[]'::jsonb;

UPDATE user_profile_settings
SET background_library = '[]'::jsonb
WHERE background_library IS NULL;
