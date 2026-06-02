import express, { type NextFunction, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbRows = vi.hoisted(() => ({ value: [] as Array<Record<string, unknown>> }));
const plan = vi.hoisted(() => ({ value: "free" }));

type RouteResponseBody = {
  user?: {
    id: number;
    email: string;
    role: "user" | "admin";
  };
};

vi.mock("@workspace/db", () => ({
  usersTable: {
    id: "id",
    name: "name",
    email: "email",
    role: "role",
    clerkId: "clerkId",
    deletedAt: "deletedAt",
    purgedAt: "purgedAt",
    stripeSubscriptionId: "stripeSubscriptionId",
    journeyType: "journeyType",
    journeyDecidedAt: "journeyDecidedAt",
    journeyDecisionSource: "journeyDecisionSource",
    testSessionId: "testSessionId",
    onboardingCompleted: "onboardingCompleted",
  },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => dbRows.value),
        })),
      })),
    })),
  },
}));

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("./check-feature", () => ({
  getEffectivePlan: vi.fn(async () => plan.value),
  planMeets: vi.fn((current: string, required: string) => {
    const rank: Record<string, number> = { free: 0, pro: 1, team: 2 };
    return (rank[current] ?? 0) >= (rank[required] ?? 0);
  }),
}));

import { optionalAuth, requireAdmin, requireAdminAccess, requireAdminToken, requireAuth, requirePremium } from "./auth";

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

function appWith(handler: express.RequestHandler | express.RequestHandler[]) {
  const app = express();
  app.get("/route", handler, (req: Request, res: Response) => res.json({ user: req.user }));
  return app;
}

describe("auth middleware", () => {
  beforeEach(() => {
    dbRows.value = [];
    plan.value = "free";
  });

  it("returns 401 for missing and invalid tokens", async () => {
    await request(appWith(requireAuth)).get("/route").expect(401);
    await request(appWith(requireAuth))
      .get("/route")
      .set("Authorization", "Bearer invalid")
      .expect(401);
  });

  it("populates req.user for valid JWTs", async () => {
    dbRows.value = [{
      id: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      deletedAt: null,
      purgedAt: null,
      stripeSubscriptionId: null,
      journeyType: "growth",
      journeyDecidedAt: null,
      journeyDecisionSource: null,
      testSessionId: null,
      onboardingCompleted: true,
    }];
    const token = jwt.sign(
      {
        userId: 42,
        name: "Ada",
        email: "ada@example.com",
        role: "user",
        onboardingCompleted: true,
        journeyType: "growth",
        stripeSubscriptionId: null,
        testSessionId: null,
      },
      "test-secret",
    );

    const response = await request(appWith(requireAuth))
      .get("/route")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const body = response.body as RouteResponseBody;
    expect(body.user).toMatchObject({
      id: 42,
      email: "ada@example.com",
      role: "user",
    });
  });

  it("rejects a valid JWT when the account has been deleted", async () => {
    dbRows.value = [{
      id: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      deletedAt: new Date("2026-06-01T10:00:00.000Z"),
      purgedAt: null,
      stripeSubscriptionId: null,
      journeyType: "growth",
      journeyDecidedAt: null,
      journeyDecisionSource: null,
      testSessionId: null,
      onboardingCompleted: true,
    }];
    const token = jwt.sign(
      {
        userId: 42,
        name: "Ada",
        email: "ada@example.com",
        role: "user",
        onboardingCompleted: true,
        journeyType: "growth",
        stripeSubscriptionId: null,
        testSessionId: null,
      },
      "test-secret",
    );

    await request(appWith(requireAuth))
      .get("/route")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });

  it("checks premium and admin access", async () => {
    const premiumApp = appWith([
      (req: Request, _res: Response, next: NextFunction) => {
        req.user = user({ id: 1 });
        next();
      },
      requirePremium,
    ]);

    await request(premiumApp).get("/route").expect(403);
    plan.value = "pro";
    await request(premiumApp).get("/route").expect(200);

    const adminApp = appWith([
      (req: Request, _res: Response, next: NextFunction) => {
        req.user = user({ id: 1, role: "user" });
        next();
      },
      requireAdmin,
    ]);
    await request(adminApp).get("/route").expect(403);

    dbRows.value = [{ role: "admin" }];
    const adminResponse = await request(adminApp).get("/route").expect(200);
    const adminBody = adminResponse.body as RouteResponseBody;
    expect(adminBody.user?.role).toBe("admin");
  });

  it("supports optional auth and admin wrapper aliases", async () => {
    const openApp = appWith(optionalAuth);
    await request(openApp).get("/route").expect(200);
    dbRows.value = [{
      id: 7,
      name: "Root",
      email: "root@example.com",
      role: "user",
      deletedAt: null,
      purgedAt: null,
      stripeSubscriptionId: null,
      journeyType: null,
      journeyDecidedAt: null,
      journeyDecisionSource: null,
      testSessionId: null,
      onboardingCompleted: false,
    }];

    const token = jwt.sign(
      {
        userId: 7,
        name: "Root",
        email: "root@example.com",
        role: "user",
        onboardingCompleted: false,
        journeyType: null,
        stripeSubscriptionId: null,
        testSessionId: null,
      },
      "test-secret",
    );
    const optionalResponse = await request(openApp)
      .get("/route")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);
    const optionalBody = optionalResponse.body as RouteResponseBody;
    expect(optionalBody.user?.id).toBe(7);

    const tokenAdminApp = appWith([
      (req: Request, _res: Response, next: NextFunction) => {
        req.user = user({ id: 7, role: "user" });
        next();
      },
      requireAdminToken,
    ]);
    dbRows.value = [{ role: "admin" }];
    await request(tokenAdminApp).get("/route").expect(200);

    const adminAccessApp = appWith(requireAdminAccess);
    await request(adminAccessApp).get("/route").expect(401);
  });
});
