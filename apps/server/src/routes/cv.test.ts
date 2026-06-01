import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const onConflictDoUpdateMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  usersTable: { clerkId: "users.clerk_id" },
  userProfileSettingsTable: {
    userId: "user_profile_settings.user_id",
    cvText: "user_profile_settings.cv_text",
    cvJson: "user_profile_settings.cv_json",
    updatedAt: "user_profile_settings.updated_at",
  },
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: onConflictDoUpdateMock,
      })),
    })),
  },
}));

import cvRouter from "./cv";

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
  instance.use(express.json({ limit: "10mb" }));
  instance.use("/api/cv", cvRouter);
  return instance;
}

describe("cv persistence-sensitive writes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    onConflictDoUpdateMock.mockResolvedValue(undefined);
  });

  it("returns an actionable 503 when generated CV save cannot persist", async () => {
    onConflictDoUpdateMock.mockRejectedValueOnce(
      Object.assign(new Error("column does not exist"), { code: "42703" }),
    );

    const response = await request(app())
      .patch("/api/cv/mine/generated")
      .set("Authorization", `Bearer ${token()}`)
      .send({ generated: { template: "classic", sections: {} } })
      .expect(503);

    expect(response.body).toMatchObject({
      status: "error",
      code: "CV_PERSISTENCE_UNAVAILABLE",
      action: "retry_after_persistence_restored",
      persistenceUnavailable: true,
    });
  });

  it("returns an actionable 503 when CV deletion cannot persist", async () => {
    onConflictDoUpdateMock.mockRejectedValueOnce(
      Object.assign(new Error("relation does not exist"), { code: "42P01" }),
    );

    const response = await request(app())
      .delete("/api/cv/mine")
      .set("Authorization", `Bearer ${token()}`)
      .expect(503);

    expect(response.body).toMatchObject({
      status: "error",
      code: "CV_PERSISTENCE_UNAVAILABLE",
      action: "retry_after_persistence_restored",
      persistenceUnavailable: true,
    });
  });
});
