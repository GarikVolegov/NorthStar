/**
 * platform-ingest.ts
 *
 * Bulk-upserts NorthStar platform content (courses, articles, career cards)
 * into knowledge_nodes with type='platform_content' and userId=0 (global namespace).
 *
 * Designed to be called:
 *   - From an admin endpoint (POST /api/admin/platform-ingest)
 *   - From a cron job after a content update in the CMS
 *   - Manually during seeding: `pnpm tsx platform-ingest.ts`
 *
 * IDEMPOTENT: uses ON CONFLICT (metadata->>'externalId') DO UPDATE,
 * so re-running never creates duplicates.
 *
 * Usage:
 *   import { ingestPlatformContent } from './platform-ingest';
 *
 *   await ingestPlatformContent([
 *     {
 *       externalId: 'course-ux-design-101',
 *       title:      'UX Design per principianti',
 *       body:       'Questo corso copre...',
 *       contentType: 'course',
 *       url:        'https://northstar.app/courses/ux-design-101',
 *       tags:       ['design', 'ux', 'carriera'],
 *     },
 *   ]);
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { embedText, chunkText } from "./embedder";

export type PlatformContentType = "course" | "article" | "career_card" | "resource";

export interface PlatformContentItem {
  /** Stable identifier from your CMS (used for idempotent upsert) */
  externalId:  string;
  title:       string;
  body:        string;
  contentType: PlatformContentType;
  url?:        string;
  tags?:       string[];
}

export interface IngestPlatformResult {
  upserted: number;
  skipped:  number;
  errors:   Array<{ externalId: string; error: string }>;
}

const PLATFORM_USER_ID = 0; // global namespace — all users can retrieve these

export async function ingestPlatformContent(
  items: PlatformContentItem[],
): Promise<IngestPlatformResult> {
  let upserted = 0;
  let skipped  = 0;
  const errors: IngestPlatformResult["errors"] = [];

  for (const item of items) {
    try {
      // Split long bodies into overlapping chunks (reuse existing chunker)
      const chunks = chunkText(item.body, 800, 80);

      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i];
        // Prefix with title so each chunk is semantically self-contained
        const fullText = `${item.title}\n\n${chunkText}`;
        const embedding = await embedText(fullText);

        const metadata = {
          externalId:  item.externalId,
          chunkIndex:  i,
          totalChunks: chunks.length,
          title:       item.title,
          contentType: item.contentType,
          url:         item.url ?? null,
          tags:        item.tags ?? [],
          source:      item.url ?? item.externalId,
        };

        // Upsert by externalId + chunkIndex so re-runs update stale content
        await db.execute(sql`
          INSERT INTO knowledge_nodes
            (user_id, content, type, embedding, metadata, created_at, updated_at)
          VALUES
            (${PLATFORM_USER_ID}, ${fullText}, 'platform_content',
             ${JSON.stringify(embedding)}::jsonb, ${JSON.stringify(metadata)}::jsonb,
             NOW(), NOW())
          ON CONFLICT ((metadata->>'externalId'), (metadata->>'chunkIndex'))
          DO UPDATE SET
            content    = EXCLUDED.content,
            embedding  = EXCLUDED.embedding,
            metadata   = EXCLUDED.metadata,
            updated_at = NOW()
        `);

        upserted++;
      }
    } catch (err) {
      skipped++;
      errors.push({
        externalId: item.externalId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { upserted, skipped, errors };
}
