/**
 * discovery-engine.service.ts — motore di scoperta per il percorso "indeciso".
 *
 * Responsabilità:
 *   1. recordSignal: registra un segnale di scoperta e ricalcola il readiness score
 *   2. getReadiness: legge lo score corrente di un utente (lo crea se manca)
 *   3. recomputeReadiness: ricalcola lo score da zero leggendo gli ultimi 90 giorni di segnali
 *
 * Score formula (max 100):
 *   selfKnowledge (25): test_complete × 12.5 + anti_test × 12.5 (cap 25)
 *   exploration   (25): sector_reaction × 2.5 + shadow_day × 8 + test_drive × 5 (cap 25)
 *   reflection    (25): diary_entry_indizi × 2 + coach_socratic_step × 5 (cap 25)
 *   emotion       (15): mood_checkin × 2 (cap 15)
 *   commitment    (10): committed signals (vita_parallela strong reactions, planned actions)
 *
 * Bande:
 *   <30  → UI minimale (mostra solo prossima azione consigliata)
 *   30-70→ Strumenti dinamici nel dashboard
 *   >70  → Wendy propone transizione di journey verso dipendente/autonomo
 */
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  userDiscoverySignalsTable,
  commitmentReadinessTable,
  DISCOVERY_SIGNAL_CATEGORIES,
  type DiscoverySignalCategory,
  type DiscoverySignalType,
  type CommitmentReadiness,
  type NewUserDiscoverySignal,
} from "@workspace/db";
import { rootLogger } from "../../middleware/logger.js";

const log = rootLogger.child({ module: "discovery-engine" });

const READINESS_WINDOW_DAYS = 90;
const CAPS = {
  selfKnowledge: 25,
  exploration: 25,
  reflection: 25,
  emotion: 15,
  commitment: 10,
} as const;

const WEIGHTS: Record<DiscoverySignalType, { category: DiscoverySignalCategory; points: number }> = {
  test_complete:           { category: "self_knowledge", points: 12.5 },
  anti_test_complete:      { category: "self_knowledge", points: 12.5 },
  sector_reaction:         { category: "exploration",    points: 2.5 },
  shadow_day_complete:     { category: "exploration",    points: 8 },
  test_drive_complete:     { category: "exploration",    points: 5 },
  diary_entry_indizi:      { category: "reflection",     points: 2 },
  coach_socratic_step:     { category: "reflection",     points: 5 },
  mood_checkin:            { category: "emotion",        points: 2 },
  vita_parallela_reaction: { category: "commitment",     points: 3 },
};

/** Registra un segnale di scoperta e ricalcola il readiness score. Idempotente per call. */
export async function recordSignal(input: {
  userId: number;
  signalType: DiscoverySignalType;
  valence?: number;        // -1..1, default 0
  intensity?: number;      // 0..1, default 0.5
  target?: string;
  payload?: Record<string, unknown>;
}): Promise<CommitmentReadiness> {
  const weight = WEIGHTS[input.signalType];
  if (!weight) {
    throw new Error(`Unknown discovery signal type: ${input.signalType}`);
  }

  const row: NewUserDiscoverySignal = {
    userId: input.userId,
    signalType: input.signalType,
    category: weight.category,
    valence: clamp(input.valence ?? 0, -1, 1),
    intensity: clamp(input.intensity ?? 0.5, 0, 1),
    target: input.target ?? null,
    payload: input.payload ?? {},
  };

  await db.insert(userDiscoverySignalsTable).values(row);
  log.debug({ userId: input.userId, signalType: input.signalType }, "[discovery] signal recorded");

  return recomputeReadiness(input.userId);
}

/** Legge il readiness corrente. Crea una riga a 0 se non esiste. */
export async function getReadiness(userId: number): Promise<CommitmentReadiness> {
  const [existing] = await db
    .select()
    .from(commitmentReadinessTable)
    .where(eq(commitmentReadinessTable.userId, userId))
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(commitmentReadinessTable)
    .values({ userId, score: 0 })
    .returning();
  return created!;
}

/** Ricalcola lo score da zero leggendo i segnali della finestra rolling. */
export async function recomputeReadiness(userId: number): Promise<CommitmentReadiness> {
  const windowStart = new Date(Date.now() - READINESS_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const counts = await db
    .select({
      signalType: userDiscoverySignalsTable.signalType,
      n: sql<number>`count(*)::int`,
      avgIntensity: sql<number>`coalesce(avg(intensity), 0.5)::float`,
    })
    .from(userDiscoverySignalsTable)
    .where(
      and(
        eq(userDiscoverySignalsTable.userId, userId),
        gte(userDiscoverySignalsTable.createdAt, windowStart),
      ),
    )
    .groupBy(userDiscoverySignalsTable.signalType);

  const components: Record<DiscoverySignalCategory, number> = {
    self_knowledge: 0,
    exploration: 0,
    reflection: 0,
    emotion: 0,
    commitment: 0,
  };

  for (const row of counts) {
    const weight = WEIGHTS[row.signalType as DiscoverySignalType];
    if (!weight) continue;
    const contribution = row.n * weight.points * (0.6 + 0.8 * row.avgIntensity); // intensity-modulated
    components[weight.category] += contribution;
  }

  // Cap each component
  const capped = {
    selfKnowledge: Math.min(components.self_knowledge, CAPS.selfKnowledge),
    exploration:   Math.min(components.exploration,    CAPS.exploration),
    reflection:    Math.min(components.reflection,     CAPS.reflection),
    emotion:       Math.min(components.emotion,        CAPS.emotion),
    commitment:    Math.min(components.commitment,     CAPS.commitment),
  };

  const score = Math.min(100, round1(
    capped.selfKnowledge + capped.exploration + capped.reflection + capped.emotion + capped.commitment,
  ));

  const nextNudge = pickNextNudge(capped);

  const [updated] = await db
    .insert(commitmentReadinessTable)
    .values({
      userId,
      score,
      components: {
        selfKnowledge: round1(capped.selfKnowledge),
        exploration:   round1(capped.exploration),
        reflection:    round1(capped.reflection),
        emotion:       round1(capped.emotion),
        commitment:    round1(capped.commitment),
      },
      nextNudge,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: commitmentReadinessTable.userId,
      set: {
        score,
        components: {
          selfKnowledge: round1(capped.selfKnowledge),
          exploration:   round1(capped.exploration),
          reflection:    round1(capped.reflection),
          emotion:       round1(capped.emotion),
          commitment:    round1(capped.commitment),
        },
        nextNudge,
        updatedAt: new Date(),
      },
    })
    .returning();

  return updated!;
}

/** Determina quale tool suggerire per primo in base al gap dominante. */
function pickNextNudge(c: {
  selfKnowledge: number; exploration: number; reflection: number; emotion: number; commitment: number;
}): CommitmentReadiness["nextNudge"] {
  const gaps = [
    { key: "selfKnowledge", gap: CAPS.selfKnowledge - c.selfKnowledge, href: "/test",                   message: "Mappa la tua personalità professionale — bastano 10 minuti." },
    { key: "emotion",       gap: CAPS.emotion       - c.emotion,       href: "/mood",                   message: "Fai un check-in: oggi come stai? 60 secondi." },
    { key: "reflection",    gap: CAPS.reflection    - c.reflection,    href: "/diario?mode=indizi",     message: "Annota un indizio: quando hai sentito curiosità oggi?" },
    { key: "exploration",   gap: CAPS.exploration   - c.exploration,   href: "/settori",                message: "Esplora un settore — niente impegno, solo curiosità." },
    { key: "commitment",    gap: CAPS.commitment    - c.commitment,    href: "/coach?mode=socratic",    message: "Apri una sessione socratica con Wendy per fare chiarezza." },
  ].sort((a, b) => b.gap - a.gap);

  const top = gaps[0]!;
  if (top.gap < 1) return null; // tutto pieno, nessun nudge

  return { component: top.key, toolHref: top.href, message: top.message };
}

/** Helper per il widget dashboard: ritorna anche la banda (low/mid/high). */
export async function getReadinessForDashboard(userId: number): Promise<{
  score: number;
  band: "low" | "mid" | "high";
  components: CommitmentReadiness["components"];
  nextNudge: CommitmentReadiness["nextNudge"];
}> {
  const r = await getReadiness(userId);
  return {
    score: r.score,
    band: r.score < 30 ? "low" : r.score < 70 ? "mid" : "high",
    components: r.components,
    nextNudge: r.nextNudge,
  };
}

/** Ritorna gli ultimi N segnali di un utente (per debug / Costellazione future). */
export async function listSignals(userId: number, limit = 50) {
  return db
    .select()
    .from(userDiscoverySignalsTable)
    .where(eq(userDiscoverySignalsTable.userId, userId))
    .orderBy(desc(userDiscoverySignalsTable.createdAt))
    .limit(limit);
}

function clamp(x: number, lo: number, hi: number) { return Math.min(hi, Math.max(lo, x)); }
function round1(x: number) { return Math.round(x * 10) / 10; }

// Suppress unused-warning for re-export consumers
export { DISCOVERY_SIGNAL_CATEGORIES };
