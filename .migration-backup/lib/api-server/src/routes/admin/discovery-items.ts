/**
 * Admin route: GET /api/admin/discovery/items
 * ───────────────────────────────────────
 *
 * Restituisce gli ultimi N item raccolti + stats aggregate.
 *
 * Query params:
 *   limit (default 20, max 100)
 *
 * Response:
 *   {
 *     items: AdminItem[],
 *     stats: {
 *       totalItems, enrichedItems,
 *       totalSources, enabledSources,
 *       lastCollectAt
 *     }
 *   }
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { discoveryItemsTable, discoverySourcesTable } from "@workspace/db";
import { desc, count, eq, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(String(req.query["limit"] ?? "20"), 10) || 20, 100);

  try {
    const [items, totalItemsRow, enrichedRow, sourcesRow, enabledSourcesRow, lastItemRow] =
      await Promise.all([
        db.select({
          id:              discoveryItemsTable.id,
          type:            discoveryItemsTable.type,
          title:           discoveryItemsTable.title,
          url:             discoveryItemsTable.url,
          source:          discoveryItemsTable.source,
          collectorSource: discoveryItemsTable.collectorSource,
          isEnriched:      discoveryItemsTable.isEnriched,
          relevanceScore:  discoveryItemsTable.relevanceScore,
          publishedAt:     discoveryItemsTable.publishedAt,
          createdAt:       discoveryItemsTable.createdAt,
        })
          .from(discoveryItemsTable)
          .orderBy(desc(discoveryItemsTable.createdAt))
          .limit(limit),

        db.select({ c: count() }).from(discoveryItemsTable),
        db.select({ c: count() }).from(discoveryItemsTable).where(eq(discoveryItemsTable.isEnriched, true)),
        db.select({ c: count() }).from(discoverySourcesTable),
        db.select({ c: count() }).from(discoverySourcesTable).where(eq(discoverySourcesTable.enabled, true)),
        db.select({ createdAt: discoveryItemsTable.createdAt })
          .from(discoveryItemsTable)
          .orderBy(desc(discoveryItemsTable.createdAt))
          .limit(1),
      ]);

    res.json({
      items,
      stats: {
        totalItems:     totalItemsRow[0]?.c  ?? 0,
        enrichedItems:  enrichedRow[0]?.c    ?? 0,
        totalSources:   sourcesRow[0]?.c     ?? 0,
        enabledSources: enabledSourcesRow[0]?.c ?? 0,
        lastCollectAt:  lastItemRow[0]?.createdAt ?? null,
      },
    });
  } catch (err) {
    console.error("[admin/items]", err);
    res.status(500).json({ error: "DB error" });
  }
});

export default router;
