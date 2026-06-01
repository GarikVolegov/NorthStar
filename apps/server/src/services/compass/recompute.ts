/**
 * recomputeCompass — il "FitEngine per la persona".
 *
 * Legge i segnali NUOVI (compass_signals) + adapter sulle fonti ESISTENTI
 * (test_sessions, simulated_days debrief, diary indizi) e li fonde via
 * scoring.ts in compass_profiles. NON duplica quei sistemi: li orchestra.
 *
 * Le trasformazioni pure vivono in ./adapters (testate senza DB).
 */
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  compassProfilesTable,
  compassSignalsTable,
  testSessionsTable,
  simulatedDaysTable,
  diaryEntriesTable,
  professionsTable,
  type CompassHypothesis,
  type CompassProfile,
} from "@workspace/db";
import {
  weightedRiasec,
  blendRiasec,
  deriveHypotheses,
  nextStage,
  directionConfidence,
  type ScoringSignal,
} from "@workspace/ai-server";
import {
  signalsFromCompass,
  signalsFromSimulatedDays,
  signalsFromDiaryIndizi,
  candidatesFromProfessions,
  buildEnergyProfile,
} from "./adapters";

export async function recomputeCompass(userId: number): Promise<CompassProfile> {
  const [existing] = await db
    .select()
    .from(compassProfilesTable)
    .where(eq(compassProfilesTable.userId, userId))
    .limit(1);

  // RIASEC dichiarato: ultima sessione test
  const [latestTest] = await db
    .select({ riasecScores: testSessionsTable.riasecScores })
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt))
    .limit(1);
  const declared = (latestTest?.riasecScores as Record<string, number>) ?? {};

  // Segnali nuovi (Specchio/Torneo/…)
  const compassRows = await db
    .select({ payload: compassSignalsTable.payload, weight: compassSignalsTable.weight, createdAt: compassSignalsTable.createdAt })
    .from(compassSignalsTable)
    .where(eq(compassSignalsTable.userId, userId));

  // Adapter: simulazioni try-a-day completate (con RIASEC della professione)
  const simRows = await db
    .select({
      debriefJson: simulatedDaysTable.debriefJson,
      completedAt: simulatedDaysTable.completedAt,
      riasecFit: professionsTable.riasecFit,
    })
    .from(simulatedDaysTable)
    .innerJoin(professionsTable, eq(simulatedDaysTable.professionId, professionsTable.id))
    .where(eq(simulatedDaysTable.userId, userId));

  // Adapter: diario degli indizi
  const diaryRows = await db
    .select({ promptPayload: diaryEntriesTable.promptPayload, createdAt: diaryEntriesTable.createdAt })
    .from(diaryEntriesTable)
    .where(and(eq(diaryEntriesTable.userId, userId), eq(diaryEntriesTable.entryType, "indizi")));

  // Cluster candidati: professioni attive
  const professions = await db
    .select({ id: professionsTable.id, title: professionsTable.title, riasecFit: professionsTable.riasecFit })
    .from(professionsTable)
    .where(eq(professionsTable.isActive, true));

  const signals: ScoringSignal[] = [
    ...signalsFromCompass(compassRows),
    ...signalsFromSimulatedDays(simRows),
    ...signalsFromDiaryIndizi(diaryRows),
  ];

  const revealed = weightedRiasec(signals);
  const blended = blendRiasec(declared, revealed, signals.length);
  const previous = (existing?.hypotheses as CompassHypothesis[]) ?? [];
  const hypotheses = deriveHypotheses(blended, candidatesFromProfessions(professions), previous);
  const stage = nextStage(existing?.stage ?? "zero_ideas", hypotheses);

  const values = {
    blockType: existing?.blockType ?? "unknown",
    revealedRiasec: revealed,
    energyProfile: buildEnergyProfile(diaryRows),
    hypotheses,
    stage,
    signalCount: signals.length,
    directionConfidence: directionConfidence(hypotheses),
    updatedAt: new Date(),
  };

  const [profile] = await db
    .insert(compassProfilesTable)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: compassProfilesTable.userId, set: values })
    .returning();

  return profile!;
}
