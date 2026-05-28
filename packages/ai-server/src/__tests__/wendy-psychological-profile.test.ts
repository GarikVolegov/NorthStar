import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSystemPrompt, type BuildSystemPromptOptions } from "../growth-agent/prompt-builder";

const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());

vi.mock("@workspace/db", () => ({
  db: { select: mockDbSelect, insert: mockDbInsert },
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
  },
  userProfilingConsentsTable: {
    userId: "user_profiling_consents.user_id",
    dimension: "user_profiling_consents.dimension",
    granted: "user_profiling_consents.granted",
    revokedAt: "user_profiling_consents.revoked_at",
  },
  coachMemoryPatternsTable: {
    userId: "coach_memory_patterns.user_id",
  },
}));

vi.mock("../logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("../metrics", () => ({
  recordToolCall: vi.fn(),
}));

const basePromptOptions = {
  userContext: { locale: "it", journeyType: "indeciso" },
  personaExamples: [],
  documentChunks: [],
  webResults: [],
  cot: null,
  userMessage: "Aiutami a scegliere",
  evalResult: {
    score: 0.9,
    level: "high" as const,
    dimensions: {
      contextCoverage: 0.9,
      cotConfidence: 0.9,
      questionClarity: 0.9,
      memoryCoverage: 0.9,
    },
    reasons: [],
    needsClarification: false,
  },
} satisfies BuildSystemPromptOptions;

describe("Wendy psychological prompt context", () => {
  it("does not inject low-confidence Big Five traits", () => {
    const prompt = buildSystemPrompt({
      ...basePromptOptions,
      userContext: {
        ...basePromptOptions.userContext,
        psychologicalProfile: {
          ocean: { openness: 0.9, conscientiousness: 0.8 },
          oceanConfidence: 0.49,
          oceanSource: "inferred",
        },
      },
    });

    expect(prompt).not.toContain("## Profilo Psicologico");
  });

  it("injects a valid psychological profile section", () => {
    const prompt = buildSystemPrompt({
      ...basePromptOptions,
      userContext: {
        ...basePromptOptions.userContext,
        psychologicalProfile: {
          ocean: {
            openness: 0.82,
            conscientiousness: 0.2,
            extraversion: 0.7,
            agreeableness: 0.8,
            neuroticism: 0.3,
          },
          oceanConfidence: 0.78,
          oceanSource: "explicit",
          decisionStyle: "analytical",
          riskTolerance: "moderate",
          communicationStyle: "concise",
          primaryValues: ["self_direction", "achievement", "benevolence"],
          primarySdtNeed: "competence",
        },
      },
    });

    expect(prompt).toContain("## Profilo Psicologico");
    expect(prompt).toContain("Personalit");
    expect(prompt).toContain("Stile decisionale");
    expect(prompt).toContain("Valori core");
    expect(prompt).toContain("Bisogno motivazionale primario");
  });

  it("uses personal chronotype in the adaptive tone section", () => {
    const prompt = buildSystemPrompt({
      ...basePromptOptions,
      userContext: {
        ...basePromptOptions.userContext,
        psychologicalProfile: {
          chronotype: "evening",
          chronotypeConfidence: 0.75,
        },
      },
      localHour: 9,
      localDayOfWeek: 2,
    });

    expect(prompt).toContain("## Tono adattivo");
    expect(prompt).toContain("utente serale");
  });
});

describe("Wendy psychological tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes profiling tools for full-path intents and marks observations as writes", async () => {
    const { getToolsForIntent } = await import("../wendy-router/tool-registry");
    const { toolRegistry } = await import("../tools/registry");

    for (const intent of ["conversation", "planning", "deep_analysis"] as const) {
      const names = getToolsForIntent(intent).map((tool) => tool.name);
      expect(names).toContain("get_psychological_profile");
      expect(names).toContain("update_personality_observation");
    }

    expect(toolRegistry.getByName("update_personality_observation")?.requiresWrite).toBe(true);
  });

  it("filters get_psychological_profile output by consent", async () => {
    const { executeToolCall } = await import("../wendy-router/tool-handlers");
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(async () => [
            { dimension: "big_five", granted: true, revokedAt: null },
            { dimension: "motivation", granted: true, revokedAt: null },
          ]),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              oceanOpenness: 0.8,
              oceanConscientiousness: 0.7,
              oceanExtraversion: 0.6,
              oceanAgreeableness: 0.5,
              oceanNeuroticism: 0.4,
              oceanSource: "explicit",
              oceanConfidence: 0.9,
              chronotype: "evening",
              chronotypeConfidence: 0.8,
              decisionStyle: "analytical",
              riskTolerance: "bold",
              communicationStyle: "detailed",
            }]),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => [{
              needAutonomy: 0.2,
              needCompetence: 0.7,
              needRelatedness: 0.1,
              primaryValues: ["achievement"],
            }]),
          })),
        })),
      });

    const result = await executeToolCall("get_psychological_profile", {}, 7);

    expect(result.ok).toBe(true);
    const data = result.ok ? result.data as Record<string, unknown> : {};
    expect(data).toMatchObject({
      ocean: { openness: 0.8 },
      oceanConfidence: 0.9,
      oceanSource: "explicit",
      primarySdtNeed: "competence",
    });
    expect(data).not.toHaveProperty("chronotype");
    expect(data).not.toHaveProperty("primaryValues");
  });

  it("rejects overlong personality observations", async () => {
    const { executeToolCall } = await import("../wendy-router/tool-handlers");

    const result = await executeToolCall(
      "update_personality_observation",
      {
        dimension: "openness",
        observation: "x".repeat(201),
        signal_strength: "strong",
      },
      7,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_INPUT");
  });

  it("requires consent before recording personality observations", async () => {
    const { executeToolCall } = await import("../wendy-router/tool-handlers");
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    });

    const result = await executeToolCall(
      "update_personality_observation",
      {
        dimension: "openness",
        observation: "Mostra curiosita verso molte strade professionali.",
        signal_strength: "moderate",
      },
      7,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("CONSENT_REQUIRED");
  });

  it("records consented personality observations with mapped confidence", async () => {
    const { executeToolCall } = await import("../wendy-router/tool-handlers");
    const insertValues = vi.fn(() => Promise.resolve());
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ granted: true, revokedAt: null }]),
        })),
      })),
    });
    mockDbInsert.mockReturnValueOnce({ values: insertValues });

    const result = await executeToolCall(
      "update_personality_observation",
      {
        dimension: "decision_style",
        observation: "Chiede dati comparativi prima di scegliere.",
        signal_strength: "strong",
      },
      7,
    );

    expect(result.ok).toBe(true);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      patternType: "personality_decision_style",
      confidence: 0.75,
      observedCount: 1,
    }));
  });
});
