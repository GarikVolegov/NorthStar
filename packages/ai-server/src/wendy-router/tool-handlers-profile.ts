import { and, eq } from "drizzle-orm";
import {
  coachMemoryPatternsTable,
  db,
  userMotivationalProfileTable,
  userProfilingConsentsTable,
  userPsychologicalProfileTable,
  type ProfilingDimension,
} from "@workspace/db";
import { logger } from "../logger";

type ToolResult = { ok: true; data: unknown } | { ok: false; code: string; message: string };

function err(code: string, message: string): ToolResult {
  return { ok: false, code, message };
}

type SdtNeed = "autonomy" | "competence" | "relatedness";
type SignalStrength = "weak" | "moderate" | "strong";

const SIGNAL_CONFIDENCE: Record<SignalStrength, number> = {
  weak: 0.35,
  moderate: 0.55,
  strong: 0.75,
};

const OBSERVATION_DIMENSIONS = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
  "risk",
  "risk_tolerance",
  "decision_style",
  "autonomy_need",
  "competence_need",
  "relatedness_need",
] as const;

type ObservationDimension = (typeof OBSERVATION_DIMENSIONS)[number];

function isObservationDimension(value: unknown): value is ObservationDimension {
  return typeof value === "string" && OBSERVATION_DIMENSIONS.includes(value as ObservationDimension);
}

function isSignalStrength(value: unknown): value is SignalStrength {
  return value === "weak" || value === "moderate" || value === "strong";
}

function consentForObservation(dimension: ObservationDimension): ProfilingDimension {
  if (
    dimension === "openness" ||
    dimension === "conscientiousness" ||
    dimension === "extraversion" ||
    dimension === "agreeableness" ||
    dimension === "neuroticism"
  ) {
    return "big_five";
  }
  if (
    dimension === "autonomy_need" ||
    dimension === "competence_need" ||
    dimension === "relatedness_need"
  ) {
    return "motivation";
  }
  return "behavioral_passive";
}

function patternTypeForObservation(dimension: ObservationDimension): string {
  return `personality_${dimension === "risk" ? "risk_tolerance" : dimension}`;
}

function topSdtNeed(row: {
  needAutonomy?: number | null;
  needCompetence?: number | null;
  needRelatedness?: number | null;
}): SdtNeed | null {
  const entries: Array<[SdtNeed, number]> = [
    ["autonomy", Number(row.needAutonomy ?? 0)],
    ["competence", Number(row.needCompetence ?? 0)],
    ["relatedness", Number(row.needRelatedness ?? 0)],
  ];
  entries.sort((a, b) => b[1] - a[1]);
  const top = entries[0];
  return top && top[1] > 0 ? top[0] : null;
}

async function hasConsent(userId: number, dimension: ProfilingDimension): Promise<boolean> {
  const [row] = await db
    .select({
      granted: userProfilingConsentsTable.granted,
      revokedAt: userProfilingConsentsTable.revokedAt,
    })
    .from(userProfilingConsentsTable)
    .where(
      and(
        eq(userProfilingConsentsTable.userId, userId),
        eq(userProfilingConsentsTable.dimension, dimension),
      ),
    )
    .limit(1);

  return row?.granted === true && row.revokedAt === null;
}

async function loadConsentSet(userId: number): Promise<Set<ProfilingDimension>> {
  const rows = await db
    .select({
      dimension: userProfilingConsentsTable.dimension,
      granted: userProfilingConsentsTable.granted,
      revokedAt: userProfilingConsentsTable.revokedAt,
    })
    .from(userProfilingConsentsTable)
    .where(eq(userProfilingConsentsTable.userId, userId));

  return new Set(
    rows
      .filter((row) => row.granted === true && row.revokedAt === null)
      .map((row) => row.dimension),
  );
}

export async function handleGetPsychologicalProfile(
  _args: Record<string, never>,
  userId: number,
): Promise<ToolResult> {
  try {
    const consents = await loadConsentSet(userId);

    const [psych] = await db
      .select({
        oceanOpenness: userPsychologicalProfileTable.oceanOpenness,
        oceanConscientiousness: userPsychologicalProfileTable.oceanConscientiousness,
        oceanExtraversion: userPsychologicalProfileTable.oceanExtraversion,
        oceanAgreeableness: userPsychologicalProfileTable.oceanAgreeableness,
        oceanNeuroticism: userPsychologicalProfileTable.oceanNeuroticism,
        oceanSource: userPsychologicalProfileTable.oceanSource,
        oceanConfidence: userPsychologicalProfileTable.oceanConfidence,
        decisionStyle: userPsychologicalProfileTable.decisionStyle,
        riskTolerance: userPsychologicalProfileTable.riskTolerance,
        communicationStyle: userPsychologicalProfileTable.communicationStyle,
        chronotype: userPsychologicalProfileTable.chronotype,
        chronotypeConfidence: userPsychologicalProfileTable.chronotypeConfidence,
      })
      .from(userPsychologicalProfileTable)
      .where(eq(userPsychologicalProfileTable.userId, userId))
      .limit(1);

    const [motivation] = await db
      .select({
        needAutonomy: userMotivationalProfileTable.needAutonomy,
        needCompetence: userMotivationalProfileTable.needCompetence,
        needRelatedness: userMotivationalProfileTable.needRelatedness,
        primaryValues: userMotivationalProfileTable.primaryValues,
      })
      .from(userMotivationalProfileTable)
      .where(eq(userMotivationalProfileTable.userId, userId))
      .limit(1);

    const payload: Record<string, unknown> = {};

    if (psych && consents.has("big_five")) {
      payload.ocean = {
        openness: psych.oceanOpenness,
        conscientiousness: psych.oceanConscientiousness,
        extraversion: psych.oceanExtraversion,
        agreeableness: psych.oceanAgreeableness,
        neuroticism: psych.oceanNeuroticism,
      };
      payload.oceanSource = psych.oceanSource;
      payload.oceanConfidence = psych.oceanConfidence ?? 0;
    }

    if (psych && consents.has("chronotype")) {
      payload.chronotype = psych.chronotype;
      payload.chronotypeConfidence = psych.chronotypeConfidence ?? 0;
    }

    if (psych && consents.has("behavioral_passive")) {
      payload.decisionStyle = psych.decisionStyle;
      payload.riskTolerance = psych.riskTolerance;
      payload.communicationStyle = psych.communicationStyle;
    }

    if (motivation && consents.has("values")) {
      payload.primaryValues = motivation.primaryValues ?? [];
    }

    if (motivation && consents.has("motivation")) {
      payload.primarySdtNeed = topSdtNeed(motivation);
    }

    return { ok: true, data: payload };
  } catch (e) {
    logger.warn({ e, userId }, "[tool] get_psychological_profile error");
    return err("UNAVAILABLE", "Profilo psicologico temporaneamente non disponibile");
  }
}

export async function handleUpdatePersonalityObservation(
  args: Record<string, unknown>,
  userId: number,
): Promise<ToolResult> {
  const dimension = args.dimension;
  const observation = typeof args.observation === "string" ? args.observation.trim() : "";
  const signalStrength = args.signal_strength;

  if (!isObservationDimension(dimension)) {
    return err("INVALID_INPUT", "Dimensione psicologica non valida");
  }
  if (!observation || observation.length > 200) {
    return err("INVALID_INPUT", "Osservazione obbligatoria, massimo 200 caratteri");
  }
  if (!isSignalStrength(signalStrength)) {
    return err("INVALID_INPUT", "signal_strength deve essere weak, moderate o strong");
  }

  const requiredConsent = consentForObservation(dimension);
  if (!(await hasConsent(userId, requiredConsent))) {
    return err("CONSENT_REQUIRED", "Consenso mancante per questa dimensione di profiling");
  }

  try {
    await db.insert(coachMemoryPatternsTable).values({
      userId,
      patternType: patternTypeForObservation(dimension),
      description: observation,
      confidence: SIGNAL_CONFIDENCE[signalStrength],
      observedCount: 1,
      sessionIds: [],
      decayScore: 1,
      lastReinforcedAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      ok: true,
      data: {
        recorded: true,
        dimension,
        confidence: SIGNAL_CONFIDENCE[signalStrength],
      },
    };
  } catch (e) {
    logger.warn({ e, userId, dimension }, "[tool] update_personality_observation error");
    return err("UNAVAILABLE", "Osservazione psicologica temporaneamente non salvabile");
  }
}
