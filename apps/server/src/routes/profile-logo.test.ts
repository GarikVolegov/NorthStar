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
    activeLogoPreset: "active_logo_preset",
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

import profileLogoRouter from "./profile-logo";

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
  instance.use(express.json());
  instance.use("/api/profile", profileLogoRouter);
  return instance;
}

describe("profile logo routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue([]);
    onConflictDoUpdateMock.mockResolvedValue(undefined);
  });

  it("returns the default logo preset when the user has not chosen one", async () => {
    const response = await request(app())
      .get("/api/profile/logo")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.activePreset.id).toBe("northstar");
    expect(response.body.activePreset.label).toBe("Icona Classica");
    expect(response.body.presets).toHaveLength(12);
    expect(response.body.presets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "northstar", assetUrl: "/logo.svg" }),
        expect.objectContaining({ id: "minimal-flat", label: "Minimal Flat" }),
        expect.objectContaining({ id: "digital-glitch", label: "Digital Glitch" }),
        expect.objectContaining({ id: "dark-mode", label: "Dark Mode" }),
      ]),
    );
  });

  it("saves a valid logo preset", async () => {
    const response = await request(app())
      .patch("/api/profile/logo")
      .set("Authorization", `Bearer ${token()}`)
      .send({ presetId: "digital-glitch" })
      .expect(200);

    expect(onConflictDoUpdateMock).toHaveBeenCalledTimes(1);
    expect(response.body.activePreset.id).toBe("digital-glitch");
    expect(response.body.activePreset.nativeIconName).toBe("AppIconDigitalGlitch");
  });

  it("rejects an unknown logo preset", async () => {
    const response = await request(app())
      .patch("/api/profile/logo")
      .set("Authorization", `Bearer ${token()}`)
      .send({ presetId: "uploaded-user-logo" })
      .expect(400);

    expect(response.body.error).toMatch(/preset/i);
    expect(onConflictDoUpdateMock).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    await request(app()).get("/api/profile/logo").expect(401);
  });
});
