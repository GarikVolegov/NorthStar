import { db, wendyNeuralEdgesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";

const DEFAULT_DECAY_DAYS = 30;
const DEFAULT_MIN_EDGE_WEIGHT = 0.5;
const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export interface NeuralEdgeDecayResult {
  updated: number;
  archivedBefore: number;
}

function computeDecayScore(lastReinforcedAt: Date, decayDays: number): number {
  const daysSince = (Date.now() - lastReinforcedAt.getTime()) / MILLIS_PER_DAY;
  return Math.pow(0.5, daysSince / Math.max(decayDays, 1));
}

export async function applyNeuralEdgeDecay(): Promise<NeuralEdgeDecayResult> {
  const decayDays = Number(process.env.WENDY_NEURAL_EDGE_DECAY_DAYS) || DEFAULT_DECAY_DAYS;
  const minEdgeWeight = Number(process.env.WENDY_NEURAL_MIN_EDGE_WEIGHT) || DEFAULT_MIN_EDGE_WEIGHT;
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - decayDays * MILLIS_PER_DAY);

  const staleEdges = await db
    .select({
      id:                 wendyNeuralEdgesTable.id,
      weight:             wendyNeuralEdgesTable.weight,
      lastReinforcedAt:   wendyNeuralEdgesTable.lastReinforcedAt,
      status:             wendyNeuralEdgesTable.status,
    })
    .from(wendyNeuralEdgesTable)
    .where(
      sql`${wendyNeuralEdgesTable.status} IN ('candidate', 'active')
        AND ${wendyNeuralEdgesTable.lastReinforcedAt} < ${staleThreshold}`,
    );

  if (staleEdges.length === 0) {
    logger.info("[neural-decay] no stale neural edges — nothing to do");
    return { updated: 0, archivedBefore: 0 };
  }

  const toUpdate: Array<{ id: number; weight: number }> = [];
  const toArchive: number[] = [];

  for (const edge of staleEdges) {
    const lastReinforcedAt = edge.lastReinforcedAt ?? now;
    const decayScore = computeDecayScore(lastReinforcedAt, decayDays);
    const effectiveWeight = (edge.weight ?? 0) * decayScore;

    if (effectiveWeight < minEdgeWeight) {
      toArchive.push(edge.id);
      continue;
    }

    toUpdate.push({ id: edge.id, weight: effectiveWeight });
  }

  if (toUpdate.length > 0) {
    await Promise.all(
      toUpdate.map((edge) =>
        db
          .update(wendyNeuralEdgesTable)
          .set({ weight: edge.weight, updatedAt: now })
          .where(sql`${wendyNeuralEdgesTable.id} = ${edge.id}`),
      ),
    );
  }

  if (toArchive.length > 0) {
    await db
      .update(wendyNeuralEdgesTable)
      .set({ status: "archived", updatedAt: now })
      .where(sql`${wendyNeuralEdgesTable.id} = ANY(${toArchive}::int[])`);
  }

  logger.info({ updated: toUpdate.length, archivedBefore: toArchive.length }, "[neural-decay] job completed");

  return {
    updated: toUpdate.length,
    archivedBefore: toArchive.length,
  };
}
