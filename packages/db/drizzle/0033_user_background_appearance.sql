ALTER TABLE user_profile_settings
  ADD COLUMN IF NOT EXISTS background_appearance JSONB DEFAULT '{
    "mode": "auto",
    "glassOpacity": 0.72,
    "blur": 18,
    "overlay": 0.32,
    "saturation": 1.08,
    "desktopPosition": "center",
    "mobilePosition": "center"
  }'::jsonb;

UPDATE user_profile_settings
SET background_appearance = '{
  "mode": "auto",
  "glassOpacity": 0.72,
  "blur": 18,
  "overlay": 0.32,
  "saturation": 1.08,
  "desktopPosition": "center",
  "mobilePosition": "center"
}'::jsonb
WHERE background_appearance IS NULL;
