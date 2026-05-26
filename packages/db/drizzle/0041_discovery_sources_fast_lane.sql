ALTER TABLE discovery_sources
  ADD COLUMN IF NOT EXISTS priority BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS source_type TEXT NOT NULL DEFAULT 'rss',
  ADD COLUMN IF NOT EXISTS scraping_url TEXT,
  ADD COLUMN IF NOT EXISTS scraping_selector TEXT;

ALTER TABLE discovery_sources
  ADD CONSTRAINT discovery_sources_source_type_check
  CHECK (source_type IN ('rss', 'api', 'scraping')) NOT VALID;
