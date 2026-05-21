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

INSERT INTO user_profile_settings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'banner_url') THEN
    EXECUTE 'UPDATE user_profile_settings p SET banner_url = u.banner_url FROM users u WHERE p.user_id = u.id AND u.banner_url IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'username') THEN
    EXECUTE 'UPDATE user_profile_settings p SET username = u.username FROM users u WHERE p.user_id = u.id AND u.username IS NOT NULL AND NOT EXISTS (SELECT 1 FROM user_profile_settings other_p WHERE other_p.username = u.username AND other_p.user_id <> u.id)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'sector_id') THEN
    EXECUTE 'UPDATE user_profile_settings p SET sector_id = u.sector_id FROM users u WHERE p.user_id = u.id AND u.sector_id IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'cv_text') THEN
    EXECUTE 'UPDATE user_profile_settings p SET cv_text = u.cv_text FROM users u WHERE p.user_id = u.id AND u.cv_text IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'cv_json') THEN
    EXECUTE 'UPDATE user_profile_settings p SET cv_json = u.cv_json FROM users u WHERE p.user_id = u.id AND u.cv_json IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_public') THEN
    EXECUTE 'UPDATE user_profile_settings p SET is_public = u.is_public FROM users u WHERE p.user_id = u.id';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'timezone') THEN
    EXECUTE 'UPDATE user_profile_settings p SET timezone = u.timezone FROM users u WHERE p.user_id = u.id AND u.timezone IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'work_preference') THEN
    EXECUTE 'UPDATE user_profile_settings p SET work_preference = u.work_preference FROM users u WHERE p.user_id = u.id AND u.work_preference IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'autonomy_preference') THEN
    EXECUTE 'UPDATE user_profile_settings p SET autonomy_preference = u.autonomy_preference FROM users u WHERE p.user_id = u.id AND u.autonomy_preference IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'stability_preference') THEN
    EXECUTE 'UPDATE user_profile_settings p SET stability_preference = u.stability_preference FROM users u WHERE p.user_id = u.id AND u.stability_preference IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'user_mode') THEN
    EXECUTE 'UPDATE user_profile_settings p SET user_mode = u.user_mode FROM users u WHERE p.user_id = u.id AND u.user_mode IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city') THEN
    EXECUTE 'UPDATE user_profile_settings p SET city = u.city FROM users u WHERE p.user_id = u.id AND u.city IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'city_place_id') THEN
    EXECUTE 'UPDATE user_profile_settings p SET city_place_id = u.city_place_id FROM users u WHERE p.user_id = u.id AND u.city_place_id IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'bio') THEN
    EXECUTE 'UPDATE user_profile_settings p SET bio = u.bio FROM users u WHERE p.user_id = u.id AND u.bio IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referred_by_code') THEN
    EXECUTE 'UPDATE user_profile_settings p SET referred_by_code = u.referred_by_code FROM users u WHERE p.user_id = u.id AND u.referred_by_code IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referred_by_affiliate_id') THEN
    EXECUTE 'UPDATE user_profile_settings p SET referred_by_affiliate_id = u.referred_by_affiliate_id FROM users u WHERE p.user_id = u.id AND u.referred_by_affiliate_id IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'referral_converted_at') THEN
    EXECUTE 'UPDATE user_profile_settings p SET referral_converted_at = u.referral_converted_at FROM users u WHERE p.user_id = u.id AND u.referral_converted_at IS NOT NULL';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_affiliate') THEN
    EXECUTE 'UPDATE user_profile_settings p SET is_affiliate = u.is_affiliate FROM users u WHERE p.user_id = u.id';
  END IF;
END $$;

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
