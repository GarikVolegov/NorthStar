import { createHash } from "node:crypto";
import { db, discoveryItemsTable, type NewDiscoveryItem } from "@workspace/db";
import { logger } from "../logger";
import { hydrateMissingImages } from "./collector-preview";
import type { RawItem } from "./collector-types";

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

export async function bulkInsertDiscoveryItems(items: RawItem[]): Promise<number> {
  if (!items.length) return 0;
  const rows: NewDiscoveryItem[] = (await hydrateMissingImages(items)).map((item) => ({
    type: item.type,
    title: item.title.slice(0, 500),
    url: item.url.slice(0, 2000),
    urlHash: hashUrl(item.url),
    source: item.source,
    summary: item.summary.slice(0, 1000),
    imageUrl: item.imageUrl,
    publishedAt: item.publishedAt,
    category: item.category,
    sectorNames: item.sectorNames,
    collectorSource: item.collectorSource,
    searchQuery: item.searchQuery,
    isEnriched: false,
    relevanceScore: 0,
  }));
  const seen = new Set<string>();
  const unique = rows.filter((row) => {
    if (seen.has(row.urlHash)) return false;
    seen.add(row.urlHash);
    return true;
  });
  let inserted = 0;
  for (let i = 0; i < unique.length; i += 50) {
    try {
      const result = await db.insert(discoveryItemsTable).values(unique.slice(i, i + 50)).onConflictDoNothing({ target: discoveryItemsTable.urlHash });
      inserted += result.rowCount ?? 0;
    } catch (err) {
      logger.warn({ err }, "[collector] bulk insert chunk failed");
    }
  }
  return inserted;
}
