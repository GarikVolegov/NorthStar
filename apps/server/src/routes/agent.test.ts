import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getEffectivePlanMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("../middleware/check-feature", () => ({
  getEffectivePlan: getEffectivePlanMock,
  planMeets: (currentPlan: string, requiredPlan: "free" | "pro" | "team") => {
    const ranks: Record<string, number> = { free: 0, pro: 1, team: 2 };
    return (ranks[currentPlan] ?? 0) >= (ranks[requiredPlan] ?? 0);
  },
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

import agentRouter from "./agent";

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
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/agent", agentRouter);
  return instance;
}

describe("agent route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getEffectivePlanMock.mockResolvedValue("free");
  });

  it("requires authentication for status introspection", async () => {
    await request(app()).get("/api/agent").expect(401);
  });

  it("returns deterministic agent status without external services", async () => {
    const response = await request(app())
      .get("/api/agent")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      success: true,
      plan: "free",
      action: {
        taskType: "status",
        status: "completed",
        mode: "deterministic",
        externalServices: false,
      },
      data: {
        status: {
          authenticated: true,
          userId: 42,
          externalServicesRequired: false,
        },
        validation: { valid: true, errors: [], warnings: [] },
      },
    });
    expect(response.body.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ taskType: "status" }),
        expect.objectContaining({ taskType: "introspection" }),
        expect.objectContaining({ taskType: "summary" }),
      ]),
    );
    expect(response.body.data.durationMs).toEqual(expect.any(Number));
  });

  it("rejects unsupported agent task types instead of returning a fake success", async () => {
    const response = await request(app())
      .post("/api/agent")
      .set("Authorization", `Bearer ${token()}`)
      .send({ taskType: "launch-external-agent", payload: {} })
      .expect(400);

    expect(response.body).toMatchObject({
      error: "Task agente non supportato",
      supportedTaskTypes: ["status", "introspection", "summary"],
    });
  });
});
