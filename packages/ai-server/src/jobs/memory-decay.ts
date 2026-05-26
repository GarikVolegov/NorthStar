/**
 * Memory Decay Job
 *
 * Runs daily (via cron or batch runner). For each active behavioral pattern
 * it computes an exponential decay score based on how long ago it was last
 * reinforced, then soft-deletes patterns whose effective_confidence falls
 * below the archive threshold.
 *
 * effective_confidence = base_confidence × decay_score
 * decay_score          = 0.5 ^ (days_since_reinforced / half_life_days)
 *
 * Schedule: run once per day, off-peak hours.
 */
import { db, coachMemoryPatternsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";
import { wendyConfig } from "../config/wendy";

export function computeDecayScore(lastReinforcedAt: Date, halfLifeDays: number): number {
  const daysSince = (Date.now() - lastReinforcedAt.getTime()) / 86_400_000;
  return Math.pow(0.5, daysSince / halfLifeDays);
}

export async function runMemoryDecayJob(): Promise<{ updated: number; archived: number }> {
  const mc = wendyConfig.memory;
  const now = new Date();
  let updated = 0;
  let archived = 0;

  // Load all active patterns that haven't been reinforced in the last 7 days
  // (recently reinforced patterns don't need decay recalculation)
  const staleThreshold = new Date(now.getTime() - 7 * 86_400_000);

  const stalePatterns = await db
    .select({
      id:               coachMemoryPatternsTable.id,
      confidence:       coachMemoryPatternsTable.confidence,
      lastReinforcedAt: coachMemoryPatternsTable.lastReinforcedAt,
    })
    .from(coachMemoryPatternsTable)
    .where(
      sql`${coachMemoryPatternsTable.deletedAt} IS NULL
        AND ${coachMemoryPatternsTable.lastReinforcedAt} < ${staleThreshold}`,
    );

  if (stalePatterns.length === 0) {
    logger.info("[memory-decay] no stale patterns — nothing to do");
    return { updated: 0, archived: 0 };
  }

  logger.info({ count: stalePatterns.length }, "[memory-decay] processing stale patterns");

  const toUpdate: Array<{ id: number; decayScore: number }> = [];
  const toArchive: number[] = [];

  for (const p of stalePatterns) {
    const reinforcedAt = p.lastReinforcedAt ?? now;
    const decay = computeDecayScore(reinforcedAt, mc.decayHalfLifeDays);
    const effectiveConf = p.confidence * decay;

    if (effectiveConf < mc.decayArchiveThreshold) {
      toArchive.push(p.id);
    } else {
      toUpdate.push({ id: p.id, decayScore: decay });
    }
  }

  // Batch update decay scores
  await Promise.all(
    toUpdate.map((p) =>
      db
        .update(coachMemoryPatternsTable)
        .set({ decayScore: p.decayScore, updatedAt: now })
        .where(sql`${coachMemoryPatternsTable.id} = ${p.id}`),
    ),
  );
  updated = toUpdate.length;

  // Soft-delete archived patterns
  if (toArchive.length > 0) {
    await db
      .update(coachMemoryPatternsTable)
      .set({ deletedAt: now, updatedAt: now })
      .where(sql`${coachMemoryPatternsTable.id} = ANY(${toArchive}::int[])`);
    archived = toArchive.length;
  }

  logger.info({ updated, archived }, "[memory-decay] job completed");
  return { updated, archived };
}
