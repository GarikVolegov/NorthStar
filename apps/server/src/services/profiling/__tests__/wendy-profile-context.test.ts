import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDbSelect = vi.hoisted(() => vi.fn());

vi.mock("@workspace/db", () => ({
  db: { select: mockDbSelect },
  userPsychologicalProfileTable: {
    userId: "user_psychological_profile.user_id",
    oceanOpenness: "user_psychological_profile.ocean_openness",
    oceanConscientiousness: "user_psychological_profile.ocean_conscientiousness",
    oceanExtraversion: "user_psychological_profile.ocean_extraversion",
    oceanAgreeableness: "user_psychological_profile.ocean_agreeableness",
    oceanNeuroticism: "user_psychological_profile.ocean_neuroticism",
    oceanSource: "user_psychological_profile.ocean_source",
    oceanConfidence: "user_psychological_profile.ocean_confidence",
    decisionStyle: "user_psychological_profile.decision_style",
    riskTolerance: "user_psychological_profile.risk_tolerance",
    communicationStyle: "user_psychological_profile.communication_style",
    chronotype: "user_psychological_profile.chronotype",
    chronotypeConfidence: "user_psychological_profile.chronotype_confidence",
  },
  userMotivationalProfileTable: {
    userId: "user_motivational_profile.user_id",
    needAutonomy: "user_motivational_profile.need_autonomy",
    needCompetence: "user_motivational_profile.need_competence",
    needRelatedness: "user_motivational_profile.need_relatedness",
    primaryValues: "user_motivational_profile.primary_values",
    valueSelfDirection: "user_motivational_profile.value_self_direction",
    valueStimulation: "user_motivational_profile.value_stimulation",
    valueHedonism: "user_motivational_profile.value_hedonism",
    valueAchievement: "user_motivational_profile.value_achievement",
    valuePower: "user_motivational_profile.value_power",
    valueSecurity: "user_motivational_profile.value_security",
    valueConformity: "user_motivational_profile.value_conformity",
    valueTradition: "user_motivational_profile.value_tradition",
    valueBenevolence: "user_motivational_profile.value_benevolence",
    valueUniversalism: "user_motivational_profile.value_universalism",
  },
  userProfilingConsentsTable: {
    userId: "user_profiling_consents.user_id",
    dimension: "user_profiling_consents.dimension",
    granted: "user_profiling_consents.granted",
    revokedAt: "user_profiling_consents.revoked_at",
  },
  userProfileSettingsTable: {
    userId: "user_profile_settings.user_id",
    timezone: "user_profile_settings.timezone",
    wendyTonePreference: "user_profile_settings.wendy_tone_preference",
  },
}));

import { computeLocalTimeSignals, loadWendyProfileContext } from "../wendy-profile-context";

function selectRows(rows: Array<Record<string, unknown>>) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(async () => rows),
      })),
    })),
  };
}

describe("wendy profile context loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes local hour and day from timezone", () => {
    const signals = computeLocalTimeSignals(
      "Europe/Rome",
      new Date("2026-05-27T08:15:00.000Z"),
    );

    expect(signals).toEqual({ localHour: 10, localDayOfWeek: 3 });
  });

  it("loads consent-filtered psychological context for Wendy", async () => {
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            { dimension: "big_five", granted: true, revokedAt: null },
            { dimension: "values", granted: true, revokedAt: null },
            { dimension: "motivation", granted: true, revokedAt: null },
            { dimension: "chronotype", granted: true, revokedAt: null },
            { dimension: "behavioral_passive", granted: true, revokedAt: null },
          ]),
        })),
      })
      .mockReturnValueOnce(selectRows([{
        oceanOpenness: 0.8,
        oceanConscientiousness: 0.7,
        oceanExtraversion: 0.3,
        oceanAgreeableness: 0.6,
        oceanNeuroticism: 0.4,
        oceanSource: "hybrid",
        oceanConfidence: 0.8,
        decisionStyle: "analytical",
        riskTolerance: "moderate",
        communicationStyle: "visual",
        chronotype: "evening",
        chronotypeConfidence: 0.7,
      }]))
      .mockReturnValueOnce(selectRows([{
        needAutonomy: 0.2,
        needCompetence: 0.7,
        needRelatedness: 0.1,
        primaryValues: [],
        valueSelfDirection: 0.9,
        valueAchievement: 0.8,
        valueBenevolence: 0.7,
      }]))
      .mockReturnValueOnce(selectRows([{
        timezone: "Europe/Rome",
        wendyTonePreference: "concise",
      }]));

    const result = await loadWendyProfileContext(
      42,
      new Date("2026-05-27T08:15:00.000Z"),
    );

    expect(result.wendyTonePreference).toBe("concise");
    expect(result.localHour).toBe(10);
    expect(result.psychologicalProfile).toMatchObject({
      ocean: { openness: 0.8 },
      chronotype: "evening",
      decisionStyle: "analytical",
      communicationStyle: "visual",
      primarySdtNeed: "competence",
      primaryValues: ["self_direction", "achievement", "benevolence"],
    });
  });
});
