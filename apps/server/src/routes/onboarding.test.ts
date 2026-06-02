import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.hoisted(() => vi.fn());
const selectMock = vi.hoisted(() => vi.fn());

vi.mock("@workspace/db", () => ({
  coachMemoryFactsTable: { userId: "coach_memory.user_id" },
  db: {
    insert: vi.fn(),
    select: selectMock,
    update: vi.fn(),
  },
  userFavoritesTable: { sectorId: "favorites.sector_id", userId: "favorites.user_id" },
  userObjectivesTable: { userId: "objectives.user_id" },
  userProfileSettingsTable: {
    horizon: "profile.horizon",
    onboardingStep: "profile.onboarding_step",
    updatedAt: "profile.updated_at",
    userId: "profile.user_id",
  },
  usersTable: {
    id: "users.id",
    journeyType: "users.journey_type",
    onboardingCompleted: "users.onboarding_completed",
    updatedAt: "users.updated_at",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, op: "eq", value }),
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    req.user = {
      email: "ada@example.com",
      id: 42,
      journeyType: "indeciso",
      name: "Ada",
      onboardingCompleted: true,
      role: "user",
      stripeSubscriptionId: null,
      testSessionId: null,
    };
    next();
  },
}));

import onboardingRouter from "./onboarding";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/onboarding", onboardingRouter);
  return instance;
}

function mockSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: limitMock.mockResolvedValueOnce(rows),
      })),
    })),
  };
  selectMock.mockReturnValueOnce(chain);
}

describe("onboarding status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats the user row as canonical when profile onboarding state is missing", async () => {
    mockSelectChain([]);
    mockSelectChain([{ onboardingCompleted: true }]);

    const response = await request(app()).get("/api/onboarding/status").expect(200);

    expect(response.body).toEqual({
      onboardingCompleted: true,
      onboardingStep: 4,
    });
  });
});
