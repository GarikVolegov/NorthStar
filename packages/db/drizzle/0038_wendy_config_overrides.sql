CREATE TABLE IF NOT EXISTS wendy_config_overrides (
  id SERIAL PRIMARY KEY,
  key VARCHAR(128) NOT NULL,
  value JSONB NOT NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS wendy_config_overrides_key_unique
  ON wendy_config_overrides (key);

CREATE INDEX IF NOT EXISTS wendy_config_overrides_updated_by_idx
  ON wendy_config_overrides (updated_by);
