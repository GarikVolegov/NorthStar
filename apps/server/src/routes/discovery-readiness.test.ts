import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.hoisted(() => vi.fn());

function queryChain() {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: limitMock,
      })),
    })),
  };
}

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => queryChain()),
  },
  usersTable: {
    id: "users.id",
    name: "users.name",
    email: "users.email",
    role: "users.role",
    stripeSubscriptionId: "users.stripe_subscription_id",
    journeyType: "users.journey_type",
    journeyDecidedAt: "users.journey_decided_at",
    journeyDecisionSource: "users.journey_decision_source",
    testSessionId: "users.test_session_id",
    onboardingCompleted: "users.onboarding_completed",
    deletedAt: "users.deleted_at",
    purgedAt: "users.purged_at",
    clerkId: "users.clerk_id",
  },
}));

import discoveryReadinessRouter from "./discovery-readiness";

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: null,
      testSessionId: 7,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/discovery", discoveryReadinessRouter);
  return instance;
}

describe("discovery readiness route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue([
      {
        id: 42,
        name: "Ada",
        email: "ada@example.com",
        role: "user",
        stripeSubscriptionId: null,
        journeyType: "indeciso",
        journeyDecidedAt: null,
        journeyDecisionSource: null,
        testSessionId: 7,
        onboardingCompleted: true,
        deletedAt: null,
        purgedAt: null,
      },
    ]);
  });

  it("requires authentication", async () => {
    await request(app()).get("/api/discovery/readiness").expect(401);
  });

  it("returns a conservative readiness payload compatible with the dashboard widgets", async () => {
    const response = await request(app())
      .get("/api/discovery/readiness")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      band: expect.stringMatching(/^(low|mid|high)$/),
      components: {
        selfKnowledge: expect.any(Number),
        exploration: expect.any(Number),
        reflection: expect.any(Number),
        emotion: expect.any(Number),
        commitment: expect.any(Number),
      },
      nextNudge: {
        component: expect.any(String),
        toolHref: expect.any(String),
        message: expect.any(String),
      },
    });
    expect(response.body.score).toBeGreaterThanOrEqual(0);
    expect(response.body.score).toBeLessThanOrEqual(100);
    expect([
      "selfKnowledge",
      "exploration",
      "reflection",
      "emotion",
      "commitment",
    ]).toContain(response.body.nextNudge.component);
  });
});
