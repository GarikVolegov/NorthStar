import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../logger";
import { getCollectorSources } from "./collector-sources";
import { bulkInsertDiscoveryItems } from "./collector-persistence";
import type { RawItem } from "./collector-types";

const COLLECTOR_LOCK_KEY = 1937832947;

export interface CollectorResult {
  totalCollected: number;
  totalInserted: number;
  bySource: Record<string, number>;
  errors: string[];
  durationMs: number;
}

async function acquireCollectorLock(): Promise<boolean> {
  try {
    const existing = await db.execute(sql`SELECT pg_try_advisory_lock(${COLLECTOR_LOCK_KEY}) AS locked`);
    return Boolean(existing.rows[0]?.locked);
  } catch {
    logger.warn("[collector] Advisory lock not available, proceeding without lock");
    return true;
  }
}

async function releaseCollectorLock(): Promise<void> {
  try {
    await db.execute(sql`SELECT pg_advisory_unlock(${COLLECTOR_LOCK_KEY})`);
  } catch {
    // ignore lock release failures
  }
}

export async function runCollector(): Promise<CollectorResult> {
  const startedAt = Date.now();
  const bySource: Record<string, number> = {};
  const errors: string[] = [];
  const allItems: RawItem[] = [];

  if (!(await acquireCollectorLock())) {
    const msg = "[collector] Another run is already in progress â€” skipping";
    logger.warn(msg);
    return { totalCollected: 0, totalInserted: 0, bySource, errors: [msg], durationMs: 0 };
  }

  await Promise.allSettled(
    getCollectorSources().map(async ({ name, fn }) => {
      try {
        const items = await fn();
        bySource[name] = items.length;
        allItems.push(...items);
      } catch (err) {
        errors.push(`${name}: ${String(err)}`);
        bySource[name] = 0;
      }
    }),
  );

  const totalInserted = await bulkInsertDiscoveryItems(allItems);
  const result: CollectorResult = {
    totalCollected: allItems.length,
    totalInserted,
    bySource,
    errors,
    durationMs: Date.now() - startedAt,
  };
  logger.info(
    { totalCollected: result.totalCollected, totalInserted: result.totalInserted, bySource: result.bySource, durationMs: result.durationMs },
    "[collector] run complete",
  );
  await releaseCollectorLock();
  return result;
}
