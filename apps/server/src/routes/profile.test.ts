import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: dbMock,
  userProfileSettingsTable: {
    activeBackgroundId: "user_profile_settings.active_background_id",
    backgroundLibrary: "user_profile_settings.background_library",
    bannerUrl: "user_profile_settings.banner_url",
    bio: "user_profile_settings.bio",
    city: "user_profile_settings.city",
    userId: "user_profile_settings.user_id",
    username: "user_profile_settings.username",
    wendyTonePreference: "user_profile_settings.wendy_tone_preference",
  },
  usersTable: {
    avatarUrl: "users.avatar_url",
    createdAt: "users.created_at",
    email: "users.email",
    emailVerified: "users.email_verified",
    id: "users.id",
    name: "users.name",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: (column: unknown, value: unknown) => ({ column, op: "eq", value }),
}));

vi.mock("../middleware/auth", () => ({
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== "Bearer test-token") {
      res.status(401).json({ error: "Token mancante" });
      return;
    }
    req.user = {
      id: 1,
      email: "ada@example.com",
      name: "Ada",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: null,
      testSessionId: null,
    };
    next();
  },
}));

import { requireAuth } from "../middleware/auth";
import profileRouter from "./profile";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.log = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as typeof req.log;
    next();
  });
  instance.use("/api/profile", requireAuth, profileRouter);
  return instance;
}

function mockProfileRow() {
  dbMock.select.mockReturnValue({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([{
            id: 2,
            name: "Grace",
            email: "grace@example.com",
            emailVerified: true,
            avatarUrl: "avatar",
            bannerUrl: "banner",
            bio: "Private bio",
            city: "London",
            username: "grace",
            wendyTonePreference: "auto",
            activeBackgroundId: null,
            backgroundLibrary: [],
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          }]),
        })),
      })),
    })),
  });
}

describe("profile route privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not let an authenticated user fetch another user's private profile details", async () => {
    mockProfileRow();

    await request(app())
      .get("/api/profile/2")
      .set("Authorization", "Bearer test-token")
      .expect(403);

    expect(dbMock.select).not.toHaveBeenCalled();
  });

  it("returns the current user's own profile details", async () => {
    mockProfileRow();

    const response = await request(app())
      .get("/api/profile/me")
      .set("Authorization", "Bearer test-token")
      .expect(200);

    expect(response.body).toMatchObject({
      email: "grace@example.com",
      bio: "Private bio",
    });
  });
});
