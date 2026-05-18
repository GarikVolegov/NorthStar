CREATE TABLE IF NOT EXISTS user_profile_settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  banner_url TEXT,
  username TEXT UNIQUE,
  sector_id INTEGER REFERENCES sectors(id),
  cv_text TEXT,
  cv_json JSONB,
  is_public BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT DEFAULT 'Europe/Rome',
  work_preference TEXT DEFAULT 'unknown',
  autonomy_preference INTEGER DEFAULT 5,
  stability_preference INTEGER DEFAULT 5,
  user_mode TEXT NOT NULL DEFAULT 'explorer',
  city TEXT,
  city_place_id TEXT,
  bio TEXT,
  referred_by_code TEXT,
  referred_by_affiliate_id INTEGER,
  referral_converted_at TIMESTAMPTZ,
  is_affiliate BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO user_profile_settings (user_id, banner_url, username, sector_id, cv_text, cv_json, is_public, timezone, work_preference, autonomy_preference, stability_preference, user_mode, city, city_place_id, bio, referred_by_code, referred_by_affiliate_id, referral_converted_at, is_affiliate, created_at, updated_at)
SELECT id, banner_url, username, sector_id, cv_text, cv_json, is_public, timezone, work_preference, autonomy_preference, stability_preference, user_mode, city, city_place_id, bio, referred_by_code, referred_by_affiliate_id, referral_converted_at, is_affiliate, created_at, updated_at
FROM users
WHERE username IS NOT NULL OR banner_url IS NOT NULL OR cv_text IS NOT NULL OR is_public = true OR work_preference != 'unknown' OR user_mode != 'explorer' OR city IS NOT NULL OR bio IS NOT NULL OR referred_by_code IS NOT NULL OR is_affiliate = true;

ALTER TABLE users DROP COLUMN IF EXISTS banner_url;
ALTER TABLE users DROP COLUMN IF EXISTS username;
ALTER TABLE users DROP COLUMN IF EXISTS sector_id;
ALTER TABLE users DROP COLUMN IF EXISTS cv_text;
ALTER TABLE users DROP COLUMN IF EXISTS cv_json;
ALTER TABLE users DROP COLUMN IF EXISTS is_public;
ALTER TABLE users DROP COLUMN IF EXISTS timezone;
ALTER TABLE users DROP COLUMN IF EXISTS work_preference;
ALTER TABLE users DROP COLUMN IF EXISTS autonomy_preference;
ALTER TABLE users DROP COLUMN IF EXISTS stability_preference;
ALTER TABLE users DROP COLUMN IF EXISTS user_mode;
ALTER TABLE users DROP COLUMN IF EXISTS city;
ALTER TABLE users DROP COLUMN IF EXISTS city_place_id;
ALTER TABLE users DROP COLUMN IF EXISTS bio;
ALTER TABLE users DROP COLUMN IF EXISTS referred_by_code;
ALTER TABLE users DROP COLUMN IF EXISTS referred_by_affiliate_id;
ALTER TABLE users DROP COLUMN IF EXISTS referral_converted_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_affiliate;

CREATE INDEX IF NOT EXISTS ups_referred_by_idx ON user_profile_settings (referred_by_affiliate_id);
CREATE INDEX IF NOT EXISTS ups_referred_by_code_idx ON user_profile_settings (referred_by_code);
CREATE INDEX IF NOT EXISTS ups_is_affiliate_idx ON user_profile_settings (is_affiliate);
CREATE INDEX IF NOT EXISTS ups_city_idx ON user_profile_settings (city);
CREATE UNIQUE INDEX IF NOT EXISTS ups_username_idx ON user_profile_settings (username);

DROP INDEX IF EXISTS users_username_idx;
DROP INDEX IF EXISTS users_referred_by_idx;
DROP INDEX IF EXISTS users_referred_by_code_idx;
DROP INDEX IF EXISTS users_is_affiliate_idx;
DROP INDEX IF EXISTS users_city_idx;
