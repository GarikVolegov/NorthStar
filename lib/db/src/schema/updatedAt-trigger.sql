-- Auto-update the updated_at column on every row UPDATE.
-- Run this migration ONCE against your PostgreSQL database.
-- This covers all tables with an updatedAt column.
-- Re-running is safe: uses DROP IF EXISTS + CREATE.

-- 1. Reusable trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach to every table that has an updated_at column
DO $do$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    -- users & social
    'users',
    'friendships',
    'job_applications',
    -- calendar
    'calendar_events',
    -- agent system
    'agent_suggestions',
    'review_queue',
    -- content
    'coach_sessions',
    'business_ideas',
    'user_objectives',
    'knowledge_nodes',
    'growth_articles',
    'news_articles',
    -- certifications & leads
    'certifications',
    'linkedin_imports',
    'affiliation_leads'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_set_updated_at ON %I;
       CREATE TRIGGER trg_set_updated_at
       BEFORE UPDATE ON %I
       FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END
$do$;
