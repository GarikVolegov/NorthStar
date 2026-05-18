ALTER TABLE "news_articles"
ADD COLUMN IF NOT EXISTS "image_url" text,
ADD COLUMN IF NOT EXISTS "content" text;
