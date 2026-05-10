/**
 * GET /api/discovery/feed
 * ─────────────────────────────────────────────────────────────────────────────
 * Restituisce il feed Discovery personalizzato per l'utente autenticato.
 *
 * QUERY PARAMS:
 *   limit        number  default 20, max 50
 *   type         string  news|opportunity|formation|growth|sector_trend (opzionale)
 *   journeyType  string  developer|designer|marketer|… (opzionale)
 *   refresh      "1"     bypassa la cache
 *
 * RESPONSE:
 *   { items: DiscoveryItem[], meta: { total, limit, typeFilter, journeyFilter } }
 *
 * LOGICA:
 *   1. Preleva item is_enriched=true con relevance_score >= 0.25
 *   2. Applica filtri opzionali (type, journeyType via @> ANY)
 *   3. Ordina: personalScore (se disponibile) → relevanceScore → publishedAt
 *   4. Aggiunge personalScore dalla tabella user_discovery_scores (se esiste)
 *
 * CACHE:
 *   In-memory LRU semplice: 5min per (userId, type, journey).
 */
import { Router, Request, Response } from "express";
import { db }                        from "@workspace/db";
import { discoveryItemsTable }       from "@workspace/db";
import { eq, gte, and, sql }         from "drizzle-orm";

const router = Router();

const MIN_RELEVANCE = 0.25;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT     = 50;

// Minimal in-memory cache: key → { data, ts }
const feedCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 min

function getCached(key: string) {
  const entry = feedCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { feedCache.delete(key); return null; }
  return entry.data;
}
function setCache(key: string, data: unknown) {
  feedCache.set(key, { data, ts: Date.now() });
  // Evict oldest if cache grows too large
  if (feedCache.size > 500) {
    const firstKey = feedCache.keys().next().value;
    if (firstKey) feedCache.delete(firstKey);
  }
}

router.get("/", async (req: Request, res: Response): Promise<void> => {
  const userId      = (req as any).user?.id ?? "anon";
  const limit       = Math.min(Number(req.query.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
  const typeFilter  = typeof req.query.type === "string" ? req.query.type : null;
  const journey     = typeof req.query.journeyType === "string" ? req.query.journeyType : null;
  const forceRefresh = req.query.refresh === "1";

  const cacheKey = `${userId}:${typeFilter}:${journey}:${limit}`;

  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) { res.json(cached); return; }
  }

  try {
    // Build WHERE conditions
    const conditions = [
      eq(discoveryItemsTable.isEnriched, true),
      gte(discoveryItemsTable.relevanceScore, MIN_RELEVANCE),
    ];

    if (typeFilter) {
      conditions.push(eq(discoveryItemsTable.type, typeFilter));
    }

    // JourneyType filter: journey_types array contains the given value
    if (journey) {
      conditions.push(
        sql`${discoveryItemsTable.journeyTypes} @> ARRAY[${journey}]::text[]`
      );
    }

    const rows = await db
      .select({
        id:              discoveryItemsTable.id,
        type:            discoveryItemsTable.type,
        category:        discoveryItemsTable.category,
        title:           discoveryItemsTable.title,
        url:             discoveryItemsTable.url,
        source:          discoveryItemsTable.source,
        summary:         discoveryItemsTable.summary,
        imageUrl:        discoveryItemsTable.imageUrl,
        publishedAt:     discoveryItemsTable.publishedAt,
        sectorNames:     discoveryItemsTable.sectorNames,
        collectorSource: discoveryItemsTable.collectorSource,
        // Enrichment fields
        isEnriched:      discoveryItemsTable.isEnriched,
        relevanceScore:  discoveryItemsTable.relevanceScore,
        skillTags:       discoveryItemsTable.skillTags,
        insightText:     discoveryItemsTable.insightText,
        journeyTypes:    discoveryItemsTable.journeyTypes,
        difficulty:      discoveryItemsTable.difficulty,
      })
      .from(discoveryItemsTable)
      .where(and(...conditions))
      .orderBy(
        sql`${discoveryItemsTable.relevanceScore} DESC`,
        sql`${discoveryItemsTable.publishedAt} DESC NULLS LAST`,
      )
      .limit(limit);

    // Map to API shape (add personalScore placeholder — future personalizer)
    const items = rows.map((r) => ({
      ...r,
      publishedAt:   r.publishedAt?.toISOString() ?? null,
      personalScore: r.relevanceScore, // will be overridden by personalizer
    }));

    const response = {
      items,
      meta: {
        total:         items.length,
        limit,
        typeFilter,
        journeyFilter: journey,
      },
    };

    setCache(cacheKey, response);
    res.json(response);
  } catch (err) {
    console.error("[discovery/feed]", err);
    res.status(500).json({ error: "Errore nel caricamento del feed" });
  }
});

export default router;
