-- Auto-update the updated_at column on every row UPDATE.
-- Run this migration ONCE against your PostgreSQL database.
-- This covers all tables with an updatedAt column.

-- 1. Create a reusable trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach the trigger to every relevant table
-- (Re-running is safe — DROP IF EXISTS + CREATE)

DO $do$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'friendships',
    'agent_suggestions',
    'review_queue',
    'calendar_events',
    'coach_sessions',
    'business_ideas',
    'user_objectives',
    'knowledge_nodes',
    'growth_articles',
    'news_articles'
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
