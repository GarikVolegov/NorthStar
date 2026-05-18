/**
 * news-publisher.ts — trasferisce discovery_items arricchiti → news_articles
 *
 * Chiamato dal cron job dopo ogni run dell'enricher.
 * Se dopo il trasferimento un settore ha < 3 articoli, inserisce placeholder
 * così il feed non è mai vuoto.
 */
import { createHash } from "node:crypto";
import { db } from "@workspace/db";
import { discoveryItemsTable, newsArticlesTable, sectorsTable } from "@workspace/db";
import { eq, gte, and, sql, count } from "drizzle-orm";

const MIN_RELEVANCE = 0.25;
const MIN_ARTICLES_PER_SECTOR = 3;

export interface NewsPublisherResult {
  transferred: number;
  seeded: number;
  durationMs: number;
}

export async function runNewsPublisher(): Promise<NewsPublisherResult> {
  const start = Date.now();
  let transferred = 0;
  let seeded = 0;

  // ── 1. Trasferisce discovery_items arricchiti → news_articles ──────────
  const enrichedItems = await db
    .select({
      title:         discoveryItemsTable.title,
      url:           discoveryItemsTable.url,
      urlHash:       discoveryItemsTable.urlHash,
      source:        discoveryItemsTable.source,
      summary:       discoveryItemsTable.summary,
      publishedAt:   discoveryItemsTable.publishedAt,
      sectorNames:   discoveryItemsTable.sectorNames,
      category:      discoveryItemsTable.category,
      relevanceScore: discoveryItemsTable.relevanceScore,
      searchQuery:   discoveryItemsTable.searchQuery,
    })
    .from(discoveryItemsTable)
    .where(
      and(
        eq(discoveryItemsTable.isEnriched, true),
        gte(discoveryItemsTable.relevanceScore, MIN_RELEVANCE),
      )
    )
    .limit(500);

  if (enrichedItems.length > 0) {
    const rows = enrichedItems.map((item) => ({
      title:         item.title,
      url:           item.url,
      urlHash:       item.urlHash,
      source:        item.source,
      summary:       item.summary,
      publishedAt:   item.publishedAt ?? new Date(),
      sectorNames:   item.sectorNames ?? [],
      category:      item.category ?? "general",
      relevanceScore: item.relevanceScore,
      searchQuery:   item.searchQuery,
    }));

    // Batch insert con upsert (skip duplicati per urlHash)
    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const result = await db
        .insert(newsArticlesTable)
        .values(batch)
        .onConflictDoNothing({ target: newsArticlesTable.urlHash });
      transferred += batch.length;
    }
  }

  // ── 2. Seed: garantisce MIN_ARTICLES_PER_SECTOR per ogni settore ────────
  const sectors = await db
    .select({ id: sectorsTable.id, name: sectorsTable.name, description: sectorsTable.description })
    .from(sectorsTable)
    .orderBy(sectorsTable.name);

  for (const sector of sectors) {
    // Conta articoli esistenti per questo settore
    const [countRow] = await db
      .select({ cnt: count() })
      .from(newsArticlesTable)
      .where(sql`${sector.name} = ANY(${newsArticlesTable.sectorNames})`);

    const existing = Number(countRow?.cnt ?? 0);
    const needed = Math.max(0, MIN_ARTICLES_PER_SECTOR - existing);

    for (let n = 0; n < needed; n++) {
      const seedUrl = `https://northstar.internal/seed/${sector.id}/${n + 1}`;
      const urlHash = createHash("sha256").update(seedUrl).digest("hex");

      await db
        .insert(newsArticlesTable)
        .values({
          title:         `${sector.name} — Aggiornamenti e trend`,
          url:           seedUrl,
          urlHash,
          source:        "NorthStar",
          summary:       sector.description.slice(0, 400),
          publishedAt:   new Date(),
          sectorNames:   [sector.name],
          category:      "general",
          relevanceScore: 0.5,
          searchQuery:   sector.name,
        })
        .onConflictDoNothing({ target: newsArticlesTable.urlHash });

      seeded++;
    }
  }

  return { transferred, seeded, durationMs: Date.now() - start };
}
