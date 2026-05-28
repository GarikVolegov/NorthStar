ALTER TABLE user_profile_settings
  ADD COLUMN IF NOT EXISTS active_logo_preset TEXT NOT NULL DEFAULT 'northstar';

UPDATE user_profile_settings
SET active_logo_preset = 'northstar'
WHERE active_logo_preset IS NULL OR active_logo_preset = '';
