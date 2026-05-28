import { eq } from "drizzle-orm";
import {
  db,
  userMotivationalProfileTable,
  userProfileSettingsTable,
  userProfilingConsentsTable,
  userPsychologicalProfileTable,
  type ProfilingDimension,
} from "@workspace/db";
import type { PsychologicalProfileContext } from "@workspace/ai-server/growth-agent/prompt-builder";

type SdtNeed = "autonomy" | "competence" | "relatedness";

export interface WendyProfileContext {
  psychologicalProfile: PsychologicalProfileContext | null;
  wendyTonePreference?: string | undefined;
  localHour?: number | undefined;
  localDayOfWeek?: number | undefined;
}

const SCHWARTZ_VALUE_FIELDS = [
  ["self_direction", "valueSelfDirection"],
  ["stimulation", "valueStimulation"],
  ["hedonism", "valueHedonism"],
  ["achievement", "valueAchievement"],
  ["power", "valuePower"],
  ["security", "valueSecurity"],
  ["conformity", "valueConformity"],
  ["tradition", "valueTradition"],
  ["benevolence", "valueBenevolence"],
  ["universalism", "valueUniversalism"],
] as const;

export function computeLocalTimeSignals(
  timezone = "Europe/Rome",
  now = new Date(),
): { localHour: number; localDayOfWeek: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(now);
    const localHour = Number(parts.find((part) => part.type === "hour")?.value ?? now.getUTCHours());
    const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return { localHour, localDayOfWeek: dayMap[weekday] ?? now.getUTCDay() };
  } catch {
    return { localHour: now.getUTCHours(), localDayOfWeek: now.getUTCDay() };
  }
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

function topSchwartzValues(row: Record<string, unknown>): string[] {
  const explicit = row.primaryValues;
  if (Array.isArray(explicit) && explicit.length > 0) {
    return explicit.map(String).slice(0, 3);
  }

  return SCHWARTZ_VALUE_FIELDS
    .map(([name, field]) => [name, Number(row[field] ?? 0)] as const)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);
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

export async function loadWendyProfileContext(
  userId: number,
  now = new Date(),
): Promise<WendyProfileContext> {
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
      valueSelfDirection: userMotivationalProfileTable.valueSelfDirection,
      valueStimulation: userMotivationalProfileTable.valueStimulation,
      valueHedonism: userMotivationalProfileTable.valueHedonism,
      valueAchievement: userMotivationalProfileTable.valueAchievement,
      valuePower: userMotivationalProfileTable.valuePower,
      valueSecurity: userMotivationalProfileTable.valueSecurity,
      valueConformity: userMotivationalProfileTable.valueConformity,
      valueTradition: userMotivationalProfileTable.valueTradition,
      valueBenevolence: userMotivationalProfileTable.valueBenevolence,
      valueUniversalism: userMotivationalProfileTable.valueUniversalism,
    })
    .from(userMotivationalProfileTable)
    .where(eq(userMotivationalProfileTable.userId, userId))
    .limit(1);

  const [settings] = await db
    .select({
      timezone: userProfileSettingsTable.timezone,
      wendyTonePreference: userProfileSettingsTable.wendyTonePreference,
    })
    .from(userProfileSettingsTable)
    .where(eq(userProfileSettingsTable.userId, userId))
    .limit(1);

  const psychologicalProfile: PsychologicalProfileContext = {};

  if (psych && consents.has("big_five")) {
    psychologicalProfile.ocean = {
      openness: psych.oceanOpenness,
      conscientiousness: psych.oceanConscientiousness,
      extraversion: psych.oceanExtraversion,
      agreeableness: psych.oceanAgreeableness,
      neuroticism: psych.oceanNeuroticism,
    };
    psychologicalProfile.oceanSource = psych.oceanSource;
    psychologicalProfile.oceanConfidence = psych.oceanConfidence ?? 0;
  }

  if (psych && consents.has("chronotype")) {
    psychologicalProfile.chronotype = psych.chronotype;
    psychologicalProfile.chronotypeConfidence = psych.chronotypeConfidence ?? 0;
  }

  if (psych && consents.has("behavioral_passive")) {
    psychologicalProfile.decisionStyle = psych.decisionStyle;
    psychologicalProfile.riskTolerance = psych.riskTolerance;
    psychologicalProfile.communicationStyle = psych.communicationStyle;
  }

  if (motivation && consents.has("values")) {
    psychologicalProfile.primaryValues = topSchwartzValues(motivation as Record<string, unknown>);
  }

  if (motivation && consents.has("motivation")) {
    psychologicalProfile.primarySdtNeed = topSdtNeed(motivation);
  }

  const timeSignals = computeLocalTimeSignals(settings?.timezone ?? "Europe/Rome", now);
  const hasPsychProfile = Object.keys(psychologicalProfile).length > 0;

  return {
    psychologicalProfile: hasPsychProfile ? psychologicalProfile : null,
    wendyTonePreference: settings?.wendyTonePreference ?? undefined,
    ...timeSignals,
  };
}
