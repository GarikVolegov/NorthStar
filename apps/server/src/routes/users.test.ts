import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { requireAuth } from "../middleware/require-auth";

const limitMock = vi.hoisted(() => vi.fn());
const poolQueryMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        leftJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: limitMock,
          })),
        })),
        where: vi.fn(() => ({
          limit: limitMock,
        })),
      })),
    })),
    insert: vi.fn(),
    update: vi.fn(),
  },
  pool: {
    query: poolQueryMock,
  },
  usersTable: {
    id: "users.id",
    name: "users.name",
    email: "users.email",
    avatarUrl: "users.avatar_url",
    createdAt: "users.created_at",
    journeyType: "users.journey_type",
  },
  userProfileSettingsTable: {
    userId: "profile.user_id",
    isPublic: "profile.is_public",
    workPreference: "profile.work_preference",
    bannerUrl: "profile.banner_url",
    bio: "profile.bio",
    city: "profile.city",
    userMode: "profile.user_mode",
  },
  friendshipsTable: {},
}));

import usersRouter from "./users";

function token(userId: number) {
  return jwt.sign(
    {
      userId,
      name: "Viewer",
      email: "viewer@example.com",
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
  instance.use("/api/users", requireAuth(), usersRouter);
  return instance;
}

describe("users public profile visibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue([
      {
        id: 42,
        name: "Private User",
        email: "private@example.com",
        avatarUrl: "https://cdn.example/avatar.png",
        createdAt: new Date("2026-05-01T10:00:00.000Z"),
        journeyType: "dipendente",
        isPublic: false,
        workPreference: "dipendente",
        bannerUrl: "https://cdn.example/banner.png",
        bio: "Private bio",
        city: "Milano",
        userMode: "explorer",
      },
    ]);
    poolQueryMock.mockResolvedValue({ rows: [] });
  });

  it("does not let a viewer spoof the target user through viewerId", async () => {
    const response = await request(app())
      .get("/api/users/42/public?viewerId=42")
      .set("Authorization", `Bearer ${token(7)}`)
      .expect(200);

    expect(response.body).toMatchObject({
      id: 42,
      name: "Private User",
      canView: false,
      areFriends: false,
    });
    expect(response.body).not.toHaveProperty("email");
    expect(response.body).not.toHaveProperty("bio");
    expect(response.body).not.toHaveProperty("bannerUrl");
  });
});
