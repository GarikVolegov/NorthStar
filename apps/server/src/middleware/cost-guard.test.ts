import type { NextFunction, Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.hoisted(() => vi.fn());
const mockSelect = vi.hoisted(() => vi.fn(() => ({ from: mockFrom })));

vi.mock("@workspace/db", () => ({
  db: { select: mockSelect },
  aiCostLogTable: {
    userId: "ai_cost_log.user_id",
    createdAt: "ai_cost_log.created_at",
    costUsdEstimate: "ai_cost_log.cost_usd_estimate",
  },
  aiRequestLogTable: {
    userId: "ai_request_log.user_id",
    createdAt: "ai_request_log.created_at",
    costUsdEst: "ai_request_log.cost_usd_est",
  },
}));

vi.mock("./check-feature", () => ({
  getEffectivePlan: vi.fn(async () => "free"),
}));

vi.mock("./logger", () => ({
  rootLogger: { warn: vi.fn(), error: vi.fn() },
}));

import { aiCostLogTable } from "@workspace/db";
import { costGuard } from "./cost-guard";

function request(): Request {
  return {
    user: {
      id: 7,
      name: "Test",
      email: "test@example.com",
      role: "user",
      stripeSubscriptionId: null,
      journeyType: null,
      testSessionId: null,
      onboardingCompleted: true,
    },
  } as Request;
}

describe("costGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      where: vi.fn(async () => [{ totalCost: 0.12 }]),
    });
  });

  it("reads monthly spend from ai_cost_log", async () => {
    const next = vi.fn() as NextFunction;
    const res = { status: vi.fn(), json: vi.fn() } as unknown as Response;

    await costGuard(request(), res, next);

    expect(mockFrom).toHaveBeenCalledWith(aiCostLogTable);
    expect(next).toHaveBeenCalledOnce();
  });
});
