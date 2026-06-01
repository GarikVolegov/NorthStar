import { createHash } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  wendyNeuralActivationsTable,
  wendyNeuralEdgesTable,
  type NewWendyNeuralActivation,
  type NewWendyNeuralEdge,
  type WendyNeuralComponents,
  type WendyNeuralEdgeStatus,
  type WendyNeuralItemKind,
} from "@workspace/db";
import { logger } from "../logger";
import { clamp01 } from "../utils";
import {
  buildBrainCandidates,
  buildMemoryCandidates,
  buildPageContextCandidate,
  buildToolCandidates,
  buildWendyBrainCandidates,
  dedupeCandidates,
} from "./candidates";
import { DEFAULT_COMPONENTS, type ActivationCandidate, type BuildWendyActivationInput, type ReinforceCoActivationsInput, type ScoredActivationItem, type WendyActivationContext } from "./types";

export type { ActivationCandidate, BuildWendyActivationInput, ReinforceCoActivationsInput, ScoredActivationItem, WendyActivationContext } from "./types";

function enabled(): boolean {
  return process.env.WENDY_NEURAL_ENABLED !== "false";
}

function maxItems(): number {
  const parsed = Number.parseInt(process.env.WENDY_NEURAL_MAX_ITEMS ?? "12", 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 24) : 12;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function hashNeuralMessage(message: string): string {
  return createHash("sha256").update(message).digest("hex");
}

function safeRef(kind: WendyNeuralItemKind, ref: string): string {
  return `${kind}:${ref}`.slice(0, 500);
}

export function scoreActivationCandidate(candidate: ActivationCandidate): ScoredActivationItem {
  const components: WendyNeuralComponents = {
    semantic: clamp01(candidate.components.semantic),
    userRelevance: clamp01(candidate.components.userRelevance),
    graphProximity: clamp01(candidate.components.graphProximity),
    recency: clamp01(candidate.components.recency),
    salience: clamp01(candidate.components.salience),
    trust: clamp01(candidate.components.trust),
  };
  const score = round3(
    components.semantic * 0.4 +
    components.userRelevance * 0.2 +
    components.graphProximity * 0.15 +
    components.recency * 0.1 +
    components.salience * 0.1 +
    components.trust * 0.05,
  );
  return {
    itemKind: candidate.itemKind,
    itemRef: candidate.itemRef,
    label: candidate.label.slice(0, 240),
    score,
    components,
    metadata: candidate.metadata ?? {},
    content: candidate.content,
  };
}

export function buildNeuralPromptSection(context: Pick<WendyActivationContext, "activeItems" | "activeTools">): string {
  const selected = context.activeItems.filter((item) => item.selected !== false).slice(0, 8);
  if (selected.length === 0) return "";
  const lines = [
    "## Attivazione neurale Wendy",
    "Questi elementi sono stati attivati come working memory del turno. Usali come segnali, non come verita assolute.",
  ];
  for (const item of selected) {
    lines.push(`- [${item.itemKind}] ${item.label} (score ${item.score.toFixed(2)})`);
  }
  if (context.activeTools.length > 0) {
    lines.push(`Tool preferiti per questo turno: ${context.activeTools.slice(0, 6).join(", ")}.`);
  }
  return lines.join("\n");
}

export async function buildWendyActivationContext(input: BuildWendyActivationInput): Promise<WendyActivationContext> {
  const messageHash = hashNeuralMessage(input.message);
  const empty: WendyActivationContext = {
    traceId: input.requestId,
    requestId: input.requestId,
    userId: input.userId,
    messageHash,
    intent: input.intent,
    domain: input.domain ?? null,
    activeItems: [],
    activeTools: [],
    promptSection: "",
    selectedRefs: [],
    activationSummary: { traceId: input.requestId, items: [], tools: [] },
  };

  if (!enabled() || !input.message.trim()) return empty;

  try {
    const [brain, wendyBrain, memory] = await Promise.all([
      buildBrainCandidates(input.message).catch(() => []),
      buildWendyBrainCandidates(input.message).catch(() => ({ candidates: [], section: "" })),
      buildMemoryCandidates(input.userId, input.message).catch(() => ({ candidates: [], section: "" })),
    ]);
    const candidates = dedupeCandidates([
      ...brain,
      ...wendyBrain.candidates,
      ...memory.candidates,
      ...buildToolCandidates(input.intent, input.message),
      ...buildPageContextCandidate(input.pageContext),
    ]);
    const scored = candidates
      .map(scoreActivationCandidate)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, maxItems())
      .map((item) => ({ ...item, selected: item.score >= 0.35 }));
    const activeTools = scored
      .filter((item) => item.itemKind === "tool" && item.selected)
      .map((item) => item.label);
    const context: WendyActivationContext = {
      ...empty,
      activeItems: scored,
      activeTools,
      selectedRefs: scored.filter((item) => item.selected).map((item) => item.itemRef),
      memorySection: memory.section,
      wendyBrainSection: wendyBrain.section,
      promptSection: "",
      activationSummary: {
        traceId: input.requestId,
        items: scored.map((item) => ({
          kind: item.itemKind,
          ref: item.itemRef,
          label: item.label,
          score: item.score,
          selected: item.selected ?? false,
        })),
        tools: activeTools,
      },
    };
    context.promptSection = buildNeuralPromptSection(context);
    return context;
  } catch (err) {
    logger.warn({ err, requestId: input.requestId }, "[wendy-neural] activation failed");
    return empty;
  }
}

export async function persistActivationTrace(context: WendyActivationContext): Promise<void> {
  if (!enabled() || context.activeItems.length === 0) return;
  const rows: NewWendyNeuralActivation[] = context.activeItems.map((item) => ({
    requestId: context.requestId,
    userId: context.userId,
    messageHash: context.messageHash,
    intent: String(context.intent).slice(0, 32),
    domain: context.domain ? String(context.domain).slice(0, 32) : null,
    itemKind: item.itemKind,
    itemRef: item.itemRef,
    label: item.label,
    score: item.score,
    components: item.components ?? DEFAULT_COMPONENTS,
    selected: item.selected ?? false,
    metadata: item.metadata ?? {},
  }));
  try {
    await db.insert(wendyNeuralActivationsTable).values(rows);
  } catch (err) {
    logger.warn({ err, requestId: context.requestId }, "[wendy-neural] persist trace failed");
  }
}

function orderedPair(a: ScoredActivationItem, b: ScoredActivationItem): [ScoredActivationItem, ScoredActivationItem] {
  const ak = safeRef(a.itemKind, a.itemRef);
  const bk = safeRef(b.itemKind, b.itemRef);
  return ak <= bk ? [a, b] : [b, a];
}

export async function reinforceCoActivations(input: ReinforceCoActivationsInput): Promise<void> {
  if (!enabled()) return;
  const selected = input.items.filter((item) => item.selected && item.score >= 0.35).slice(0, 8);
  if (selected.length < 2) return;
  const rows: NewWendyNeuralEdge[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length; j += 1) {
      const left = selected[i];
      const right = selected[j];
      if (!left || !right) continue;
      const [source, target] = orderedPair(left, right);
      const key = `${safeRef(source.itemKind, source.itemRef)}>${safeRef(target.itemKind, target.itemRef)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        userId: input.userId ?? null,
        sourceItemKind: source.itemKind,
        sourceItemRef: source.itemRef,
        targetItemKind: target.itemKind,
        targetItemRef: target.itemRef,
        relationType: "co_activated",
        weight: round3(Math.min(1, 0.1 + (source.score + target.score) / 8)),
        decayScore: 1,
        evidenceCount: 1,
        status: "candidate",
        metadata: { requestId: input.requestId },
        lastReinforcedAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  if (rows.length === 0) return;
  try {
    const set = {
      weight: sql`LEAST(1, ${wendyNeuralEdgesTable.weight} + 0.05)`,
      decayScore: 1,
      evidenceCount: sql`${wendyNeuralEdgesTable.evidenceCount} + 1`,
      lastReinforcedAt: new Date(),
      updatedAt: new Date(),
    };
    if (input.userId) {
      await db.insert(wendyNeuralEdgesTable).values(rows).onConflictDoUpdate({
        target: [
          wendyNeuralEdgesTable.userId,
          wendyNeuralEdgesTable.sourceItemKind,
          wendyNeuralEdgesTable.sourceItemRef,
          wendyNeuralEdgesTable.targetItemKind,
          wendyNeuralEdgesTable.targetItemRef,
          wendyNeuralEdgesTable.relationType,
        ],
        targetWhere: sql`${wendyNeuralEdgesTable.userId} IS NOT NULL`,
        set,
      });
    } else {
      await db.insert(wendyNeuralEdgesTable).values(rows).onConflictDoUpdate({
        target: [
          wendyNeuralEdgesTable.sourceItemKind,
          wendyNeuralEdgesTable.sourceItemRef,
          wendyNeuralEdgesTable.targetItemKind,
          wendyNeuralEdgesTable.targetItemRef,
          wendyNeuralEdgesTable.relationType,
        ],
        targetWhere: sql`${wendyNeuralEdgesTable.userId} IS NULL`,
        set,
      });
    }
  } catch (err) {
    logger.warn({ err, requestId: input.requestId }, "[wendy-neural] reinforce failed");
  }
}

export async function applyNeuralEdgeDecay(now = new Date()): Promise<{ archivedEdges: number; decayDays: number }> {
  const parsedDays = Number.parseInt(process.env.WENDY_NEURAL_EDGE_DECAY_DAYS ?? "30", 10);
  const minWeight = Number.parseFloat(process.env.WENDY_NEURAL_MIN_EDGE_WEIGHT ?? "0.15");
  const decayDays = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 30;
  const cutoff = new Date(now.getTime() - decayDays * 24 * 60 * 60 * 1000);

  await db
    .update(wendyNeuralEdgesTable)
    .set({
      decayScore: sql`GREATEST(0, ${wendyNeuralEdgesTable.decayScore} * 0.95)`,
      updatedAt: now,
    })
    .where(sql`${wendyNeuralEdgesTable.lastReinforcedAt} < ${cutoff}`);

  const archived = await db
    .update(wendyNeuralEdgesTable)
    .set({ status: "archived" as WendyNeuralEdgeStatus, updatedAt: now })
    .where(and(
      eq(wendyNeuralEdgesTable.status, "candidate"),
      sql`${wendyNeuralEdgesTable.weight} * ${wendyNeuralEdgesTable.decayScore} < ${Number.isFinite(minWeight) ? minWeight : 0.15}`,
    ))
    .returning({ id: wendyNeuralEdgesTable.id });

  return { archivedEdges: archived.length, decayDays };
}

export async function listRecentNeuralActivations(limit = 50) {
  return db
    .select()
    .from(wendyNeuralActivationsTable)
    .orderBy(desc(wendyNeuralActivationsTable.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export async function listNeuralActivationsByRequest(requestId: string) {
  return db
    .select()
    .from(wendyNeuralActivationsTable)
    .where(eq(wendyNeuralActivationsTable.requestId, requestId))
    .orderBy(desc(wendyNeuralActivationsTable.score));
}
