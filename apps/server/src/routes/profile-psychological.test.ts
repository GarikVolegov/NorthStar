import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue = vi.hoisted(() => [] as unknown[][]);
const insertCalls = vi.hoisted(() => [] as Array<{ table: unknown; values: unknown; conflict?: unknown }>);
const updateCalls = vi.hoisted(() => [] as Array<{ table: unknown; set: unknown; returning?: unknown }>);

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  eq: vi.fn((left: unknown, right: unknown) => ({ op: "eq", left, right })),
  ne: vi.fn((left: unknown, right: unknown) => ({ op: "ne", left, right })),
}));

function selectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => chain),
    leftJoin: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(rows)),
  };
  return chain;
}

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => selectChain(selectQueue.shift() ?? [])),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: unknown) => {
        const call: { table: unknown; values: unknown; conflict?: unknown } = { table, values };
        insertCalls.push(call);
        return {
          onConflictDoUpdate: vi.fn((conflict: unknown) => {
            call.conflict = conflict;
            return Promise.resolve(undefined);
          }),
        };
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((set: unknown) => {
        const call: { table: unknown; set: unknown; returning?: unknown } = { table, set };
        updateCalls.push(call);
        return {
          where: vi.fn(() => ({
            returning: vi.fn((returning: unknown) => {
              call.returning = returning;
              return Promise.resolve([{ name: "Ada" }]);
            }),
          })),
        };
      }),
    })),
  },
  usersTable: {
    id: "users.id",
    name: "users.name",
    email: "users.email",
    emailVerified: "users.emailVerified",
    avatarUrl: "users.avatarUrl",
    createdAt: "users.createdAt",
    updatedAt: "users.updatedAt",
  },
  userProfileSettingsTable: {
    userId: "settings.userId",
    bannerUrl: "settings.bannerUrl",
    activeBackgroundId: "settings.activeBackgroundId",
    backgroundLibrary: "settings.backgroundLibrary",
    bio: "settings.bio",
    city: "settings.city",
    username: "settings.username",
    wendyTonePreference: "settings.wendyTonePreference",
    updatedAt: "settings.updatedAt",
  },
  PROFILING_DIMENSIONS: [
    "big_five",
    "values",
    "motivation",
    "linguistic",
    "behavioral_passive",
    "chronotype",
  ],
  userPsychologicalProfileTable: {
    userId: "psych.userId",
    oceanOpenness: "psych.oceanOpenness",
    oceanConscientiousness: "psych.oceanConscientiousness",
    oceanExtraversion: "psych.oceanExtraversion",
    oceanAgreeableness: "psych.oceanAgreeableness",
    oceanNeuroticism: "psych.oceanNeuroticism",
    oceanSource: "psych.oceanSource",
    oceanConfidence: "psych.oceanConfidence",
    decisionStyle: "psych.decisionStyle",
    riskTolerance: "psych.riskTolerance",
    communicationStyle: "psych.communicationStyle",
    chronotype: "psych.chronotype",
    chronotypeConfidence: "psych.chronotypeConfidence",
    createdAt: "psych.createdAt",
    updatedAt: "psych.updatedAt",
    deletedAt: "psych.deletedAt",
  },
  userMotivationalProfileTable: {
    userId: "motiv.userId",
    needAutonomy: "motiv.needAutonomy",
    needCompetence: "motiv.needCompetence",
    needRelatedness: "motiv.needRelatedness",
    needAchievement: "motiv.needAchievement",
    needAffiliation: "motiv.needAffiliation",
    needPower: "motiv.needPower",
    valueSelfDirection: "motiv.valueSelfDirection",
    valueStimulation: "motiv.valueStimulation",
    valueHedonism: "motiv.valueHedonism",
    valueAchievement: "motiv.valueAchievement",
    valuePower: "motiv.valuePower",
    valueSecurity: "motiv.valueSecurity",
    valueConformity: "motiv.valueConformity",
    valueTradition: "motiv.valueTradition",
    valueBenevolence: "motiv.valueBenevolence",
    valueUniversalism: "motiv.valueUniversalism",
    primaryValues: "motiv.primaryValues",
    createdAt: "motiv.createdAt",
    updatedAt: "motiv.updatedAt",
    deletedAt: "motiv.deletedAt",
  },
  userProfilingConsentsTable: {
    userId: "consent.userId",
    dimension: "consent.dimension",
    granted: "consent.granted",
    grantedAt: "consent.grantedAt",
    revokedAt: "consent.revokedAt",
    updatedAt: "consent.updatedAt",
  },
  userBehavioralSignalsTable: {
    userId: "signals.userId",
    questionVsStatement: "signals.questionVsStatement",
    negativeEmotionWords: "signals.negativeEmotionWords",
    uncertaintyMarkers: "signals.uncertaintyMarkers",
    socialWordUsage: "signals.socialWordUsage",
    futureTemporalFocus: "signals.futureTemporalFocus",
  },
}));

import profileRouter from "./profile";

function token(userId = 42) {
  return jwt.sign(
    {
      userId,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: null,
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/profile", profileRouter);
  return instance;
}

describe("psychological profile routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectQueue.length = 0;
    insertCalls.length = 0;
    updateCalls.length = 0;
  });

  it("returns consent-filtered profile data before the /:userId route can shadow it", async () => {
    selectQueue.push(
      [
        { dimension: "big_five", granted: true, grantedAt: "2026-05-20T00:00:00.000Z", revokedAt: null },
        { dimension: "values", granted: false, grantedAt: "2026-05-20T00:00:00.000Z", revokedAt: "2026-05-21T00:00:00.000Z" },
        { dimension: "motivation", granted: true, grantedAt: "2026-05-20T00:00:00.000Z", revokedAt: null },
        { dimension: "chronotype", granted: true, grantedAt: "2026-05-20T00:00:00.000Z", revokedAt: null },
      ],
      [{
        oceanOpenness: 0.8,
        oceanConscientiousness: 0.7,
        oceanExtraversion: 0.4,
        oceanAgreeableness: 0.6,
        oceanNeuroticism: 0.2,
        oceanSource: "explicit",
        oceanConfidence: 0.85,
        decisionStyle: "analytical",
        riskTolerance: "moderate",
        communicationStyle: "detailed",
        chronotype: "morning",
        chronotypeConfidence: 0.72,
        createdAt: "2026-05-19T00:00:00.000Z",
        updatedAt: "2026-05-22T00:00:00.000Z",
      }],
      [{
        needAutonomy: 0.9,
        needCompetence: 0.5,
        needRelatedness: 0.4,
        needAchievement: 0.6,
        needAffiliation: 0.3,
        needPower: 0.2,
        valueSelfDirection: 0.9,
        valueAchievement: 0.8,
        primaryValues: ["self_direction", "achievement"],
        createdAt: "2026-05-19T00:00:00.000Z",
        updatedAt: "2026-05-22T00:00:00.000Z",
      }],
    );

    const response = await request(app())
      .get("/api/profile/psychological-profile")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.profile.ocean).toMatchObject({ openness: 0.8, conscientiousness: 0.7 });
    expect(response.body.profile.chronotype).toBe("morning");
    expect(response.body.profile.primarySdtNeed).toBe("autonomy");
    expect(response.body.profile.primaryValues).toBeUndefined();
    expect(response.body.consents).toHaveLength(6);
  });

  it("grants consent and stores manual overrides as explicit confidence 0.75", async () => {
    const response = await request(app())
      .patch("/api/profile/psychological-profile")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        consents: { big_five: true },
        profile: {
          ocean: {
            openness: 0.9,
            conscientiousness: 0.8,
            extraversion: 0.5,
            agreeableness: 0.6,
            neuroticism: 0.2,
          },
        },
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(insertCalls.some((call) => JSON.stringify(call.values).includes("big_five"))).toBe(true);
    expect(insertCalls.some((call) => {
      const values = call.values as Record<string, unknown>;
      return values.oceanSource === "explicit" && values.oceanConfidence === 0.75;
    })).toBe(true);
  });

  it("rejects invalid override scores and enum values", async () => {
    await request(app())
      .patch("/api/profile/psychological-profile")
      .set("Authorization", `Bearer ${token()}`)
      .send({ profile: { ocean: { openness: 2 }, decisionStyle: "chaotic" } })
      .expect(400);
  });

  it("revokes consent and clears only the requested dimension", async () => {
    const response = await request(app())
      .delete("/api/profile/psychological-profile/big_five")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({ success: true, dimension: "big_five" });
    expect(insertCalls.some((call) => {
      const values = call.values as Record<string, unknown>;
      return values.dimension === "big_five" && values.granted === false && "revokedAt" in values;
    })).toBe(true);
    expect(updateCalls.some((call) => {
      const set = call.set as Record<string, unknown>;
      return (
        set.oceanOpenness === null &&
        set.oceanSource === null &&
        !("decisionStyle" in set)
      );
    })).toBe(true);
  });
});
