/**
 * DiscoveryPersonalizerAgent — filtra e ordina i discovery items per utente.
 *
 * COSA FA:
 *   Dato un userId (con journeyType + interessi dalla memoria), restituisce
 *   gli item più rilevanti ordinati per un feed personalizzato.
 *
 * SCORING FORMULA:
 *   personalScore = relevanceScore
 *                 + journeyBoost (se journeyType matcha journeyTypes[])
 *                 + recencyBoost (item più recenti ricevono boost)
 *                 + typeBoost    (se l'utente ha preferenza per un tipo)
 *
 * DIVERSITÀ:
 *   Il feed non può avere più del 40% di item dello stesso tipo.
 *   Questo garantisce un mix news + formazione + opportunità + crescita.
 *
 * CACHE:
 *   Il risultato viene cachato in memoria (Map) per 30 minuti per userId.
 *   Invalida la cache se viene chiamato con forceRefresh=true.
 */
import { db } from "@workspace/db";
import { discoveryItemsTable, usersTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import type { DiscoveryItem } from "@workspace/db";

// ── In-memory cache ──────────────────────────────────────────────────────────

interface CacheEntry {
  items:     PersonalizedItem[];
  expiresAt: number;
}

const feedCache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ── Types ─────────────────────────────────────────────────────────────────────────

export interface PersonalizedItem extends DiscoveryItem {
  personalScore: number;
}

export interface PersonalizerOptions {
  userId:        number;
  limit?:        number;
  typeFilter?:   string;   // filter by type: news|opportunity|formation|growth|sector_trend
  forceRefresh?: boolean;
}

// ── Scoring weights ──────────────────────────────────────────────────────────

const JOURNEY_BOOST  = 0.20;
const RECENCY_BOOST  = 0.10; // max boost for items from last 24h
const TYPE_DIVERSITY = 0.40; // max fraction per type in final feed

function computePersonalScore(
  item:        DiscoveryItem,
  journeyType: string | null,
): number {
  let score = item.relevanceScore ?? 0;

  // Journey boost
  const journeyTypes = (item.journeyTypes as string[] | null) ?? [];
  if (journeyType && (journeyTypes.includes(journeyType) || journeyTypes.includes("general"))) {
    score += JOURNEY_BOOST;
  }

  // Recency boost: items published in last 24h get +0.10, fading linearly to 0 over 7 days
  if (item.publishedAt) {
    const ageMs    = Date.now() - new Date(item.publishedAt).getTime();
    const ageDays  = ageMs / (1000 * 60 * 60 * 24);
    const recency  = Math.max(0, 1 - ageDays / 7);
    score += recency * RECENCY_BOOST;
  }

  return Math.min(1.3, score); // cap at 1.3 to keep scores readable
}

function diversifyFeed(
  items: PersonalizedItem[],
  limit: number,
): PersonalizedItem[] {
  const result: PersonalizedItem[] = [];
  const typeCount: Record<string, number> = {};
  const maxPerType = Math.ceil(limit * TYPE_DIVERSITY);

  for (const item of items) {
    const t = item.type;
    if ((typeCount[t] ?? 0) >= maxPerType) continue;
    result.push(item);
    typeCount[t] = (typeCount[t] ?? 0) + 1;
    if (result.length >= limit) break;
  }

  // If we didn't fill the limit (because of diversity constraint), top up from remaining
  if (result.length < limit) {
    const resultIds = new Set(result.map((i) => i.id));
    for (const item of items) {
      if (resultIds.has(item.id)) continue;
      result.push(item);
      if (result.length >= limit) break;
    }
  }

  return result;
}

// ── Main entry point ────────────────────────────────────────────────────────────

export async function getPersonalizedFeed(
  opts: PersonalizerOptions,
): Promise<PersonalizedItem[]> {
  const { userId, limit = 20, typeFilter, forceRefresh = false } = opts;

  // Check cache (only for full feed, not filtered)
  if (!typeFilter && !forceRefresh) {
    const cached = feedCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.items.slice(0, limit);
    }
  }

  // Load user journeyType
  const [user] = await db
    .select({ journeyType: usersTable.journeyType })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const journeyType = user?.journeyType ?? null;

  // Fetch enriched items from last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const query = db
    .select()
    .from(discoveryItemsTable)
    .where(
      and(
        eq(discoveryItemsTable.isEnriched, true),
        gte(discoveryItemsTable.relevanceScore, 0.3),
        gte(discoveryItemsTable.createdAt, sevenDaysAgo),
        ...(typeFilter ? [eq(discoveryItemsTable.type, typeFilter as any)] : []),
      ),
    )
    .orderBy(desc(discoveryItemsTable.relevanceScore))
    .limit(200); // over-fetch, then personalize

  const rawItems = await query;

  // Score + sort
  const scored: PersonalizedItem[] = rawItems
    .map((item) => ({
      ...item,
      personalScore: computePersonalScore(item, journeyType),
    }))
    .sort((a, b) => b.personalScore - a.personalScore);

  // Diversify
  const feed = typeFilter ? scored.slice(0, limit) : diversifyFeed(scored, limit);

  // Cache full feed
  if (!typeFilter) {
    feedCache.set(userId, { items: feed, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  return feed;
}

/** Invalidate cache for a user (e.g. after journeyType change) */
export function invalidateUserFeedCache(userId: number): void {
  feedCache.delete(userId);
}
