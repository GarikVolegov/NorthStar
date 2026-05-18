CREATE TABLE IF NOT EXISTS "news_articles" (
  "id" serial PRIMARY KEY,
  "title" text NOT NULL,
  "url" text NOT NULL UNIQUE,
  "url_hash" text NOT NULL UNIQUE,
  "source" text NOT NULL DEFAULT '',
  "summary" text NOT NULL DEFAULT '',
  "published_at" timestamptz,
  "sector_names" text[] NOT NULL DEFAULT '{}',
  "category" text NOT NULL DEFAULT 'general',
  "relevance_score" real NOT NULL DEFAULT 0,
  "search_query" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_articles_url_hash_idx" ON "news_articles" ("url_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_articles_published_at_idx" ON "news_articles" ("published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "news_articles_created_at_idx" ON "news_articles" ("created_at");
