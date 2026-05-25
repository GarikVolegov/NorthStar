import express from "express";
import type { NextFunction, Request, Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbRows = vi.hoisted(() => ({ value: [] as Array<{ plan: string; validUntil: Date | null }> }));

vi.mock("@workspace/db", () => ({
  subscriptionsTable: {
    userId: "userId",
    plan: "plan",
    validUntil: "validUntil",
    cancelledAt: "cancelledAt",
    createdAt: "createdAt",
  },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(async () => dbRows.value),
          })),
        })),
      })),
    })),
  },
}));

import {
  checkFeatureAccess,
  invalidatePlanCache,
  planMeets,
  requireFeature,
} from "./check-feature";

function user(overrides: Partial<NonNullable<Express.Request["user"]>> = {}): NonNullable<Express.Request["user"]> {
  return {
    id: 1,
    name: "Test User",
    email: "test@example.com",
    role: "user",
    stripeSubscriptionId: null,
    journeyType: null,
    testSessionId: null,
    onboardingCompleted: false,
    ...overrides,
  };
}

describe("check-feature middleware", () => {
  beforeEach(() => {
    dbRows.value = [];
    invalidatePlanCache(1);
  });

  it("orders plans by rank", () => {
    expect(planMeets("free", "pro")).toBe(false);
    expect(planMeets("pro", "pro")).toBe(true);
    expect(planMeets("team", "pro")).toBe(true);
  });

  it("uses cached plan lookup and invalidation", async () => {
    dbRows.value = [{ plan: "pro", validUntil: null }];
    await expect(checkFeatureAccess(1, "rag_search")).resolves.toMatchObject({
      allowed: true,
      currentPlan: "pro",
    });

    dbRows.value = [];
    await expect(checkFeatureAccess(1, "rag_search")).resolves.toMatchObject({
      currentPlan: "pro",
    });

    invalidatePlanCache(1);
    await expect(checkFeatureAccess(1, "rag_search")).resolves.toMatchObject({
      allowed: false,
      currentPlan: "free",
    });
  });

  it("blocks JSON and SSE feature gates", async () => {
    const app = express();
    app.get("/json", (req: Request, _res: Response, next: NextFunction) => {
      req.user = user({ id: 1 });
      next();
    }, requireFeature("rag_search"), (_req, res) => res.json({ ok: true }));
    app.get("/sse", (req: Request, _res: Response, next: NextFunction) => {
      req.user = user({ id: 1 });
      next();
    }, requireFeature("rag_search", "sse"));

    const json = await request(app).get("/json").expect(402);
    expect(json.body).toMatchObject({
      code: "PLAN_REQUIRED",
      feature: "rag_search",
      requiredPlan: "pro",
      currentPlan: "free",
    });

    const sse = await request(app).get("/sse").expect(200);
    expect(sse.headers["content-type"]).toContain("text/event-stream");
    expect(sse.text).toContain('"type":"gate"');
  });
});
