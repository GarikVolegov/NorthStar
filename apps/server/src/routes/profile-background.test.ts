import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.hoisted(() => vi.fn());
const onConflictDoUpdateMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  usersTable: {
    clerkId: "clerk_id",
  },
  userProfileSettingsTable: {
    userId: "user_id",
    activeBackgroundId: "active_background_id",
    backgroundLibrary: "background_library",
    backgroundAppearance: "background_appearance",
    updatedAt: "updated_at",
  },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: limitMock,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: onConflictDoUpdateMock,
      })),
    })),
  },
}));

import profileBackgroundRouter from "./profile-background";

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
  instance.use(express.json({ limit: "10mb" }));
  instance.use("/api/profile", profileBackgroundRouter);
  return instance;
}

describe("profile background routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue([]);
    onConflictDoUpdateMock.mockResolvedValue(undefined);
  });

  it("reads backgrounds through the authenticated /me alias", async () => {
    const response = await request(app())
      .get("/api/profile/me/backgrounds")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({ activeBackgroundId: null, library: [] });
  });

  it("sets an active preset through /me", async () => {
    const response = await request(app())
      .patch("/api/profile/me/backgrounds/active")
      .set("Authorization", `Bearer ${token()}`)
      .send({ id: "preset:aurora" })
      .expect(200);

    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(1);
    expect(response.body).toEqual({ activeBackgroundId: "preset:aurora" });
  });

  it("keeps userId routes protected from another user", async () => {
    await request(app())
      .get("/api/profile/7/backgrounds")
      .set("Authorization", `Bearer ${token(42)}`)
      .expect(403);
  });

  it("degrades read when optional background columns are missing", async () => {
    limitMock.mockRejectedValueOnce(Object.assign(new Error("column does not exist"), { code: "42703" }));

    const response = await request(app())
      .get("/api/profile/me/backgrounds")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({ activeBackgroundId: null, library: [] });
  });

  it("returns explicit persistence error on writes when schema is missing", async () => {
    onConflictDoUpdateMock.mockRejectedValueOnce(Object.assign(new Error("column does not exist"), { code: "42703" }));

    const response = await request(app())
      .patch("/api/profile/me/backgrounds/active")
      .set("Authorization", `Bearer ${token()}`)
      .send({ id: "preset:focus" })
      .expect(503);

    expect(response.body).toMatchObject({
      persistenceUnavailable: true,
      setupAction: "run_migrations",
    });
  });

  it("updates liquid glass appearance settings", async () => {
    const response = await request(app())
      .patch("/api/profile/me/backgrounds/appearance")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        mode: "manual",
        glassOpacity: 0.62,
        blur: 18,
        overlay: 0.28,
        saturation: 1.12,
        desktopPosition: "center",
        mobilePosition: "top",
      })
      .expect(200);

    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(1);
    expect(response.body).toMatchObject({
      appearance: {
        mode: "manual",
        glassOpacity: 0.62,
        blur: 18,
        overlay: 0.28,
        saturation: 1.12,
        desktopPosition: "center",
        mobilePosition: "top",
      },
    });
  });
});
