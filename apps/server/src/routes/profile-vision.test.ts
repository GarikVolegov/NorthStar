import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AIPlugin } from "@workspace/ai-server";
import type * as AiServerModule from "@workspace/ai-server";

const executeMock = vi.hoisted(() => vi.fn());
const getBestMock = vi.hoisted(() => vi.fn());
const insertMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/ai-server", async (importOriginal) => {
  const actual = await importOriginal<typeof AiServerModule>();
  return {
    ...actual,
    aiPlugins: {
      getBest: getBestMock,
    },
  };
});

vi.mock("@workspace/db", () => ({
  userProfileSettingsTable: {
    userId: "user_id",
    cvText: "cv_text",
    cvJson: "cv_json",
    updatedAt: "updated_at",
  },
  db: {
    insert: insertMock,
  },
}));

import profileVisionRouter from "./profile-vision";

function token() {
  return jwt.sign(
    {
      userId: 42,
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
  instance.use("/api/profile-vision", profileVisionRouter);
  return instance;
}

function mockVisionPlugin(): AIPlugin {
  return {
    id: "vision-test",
    capability: "vision",
    version: "1.0.0",
    provider: "test",
    init: async () => {},
    health: async () => ({ ok: true }),
    execute: executeMock,
  };
}

describe("profile vision routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBestMock.mockReturnValue(mockVisionPlugin());
    executeMock.mockResolvedValue({
      rawText: "Profilo tecnico TypeScript",
      structured: {
        summary: "Profilo tecnico",
        skills: ["TypeScript", "React"],
      },
    });
    insertMock.mockReturnValue({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(async () => undefined),
      })),
    });
  });

  it("requires auth", async () => {
    await request(app()).post("/api/profile-vision/analyze-cv").expect(401);
  });

  it("returns a preview without writing profile data", async () => {
    const response = await request(app())
      .post("/api/profile-vision/analyze-cv")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        fileDataUrl: "data:image/png;base64,ZmFrZQ==",
        apply: false,
      })
      .expect(200);

    expect(executeMock).toHaveBeenCalledWith(expect.objectContaining({
      image: expect.any(Buffer) as Buffer,
      mimeType: "image/png",
    }));
    expect(insertMock).not.toHaveBeenCalled();
    expect(response.body).toMatchObject({
      status: "preview",
      source: "vision",
      profilePatch: {
        cvText: "Profilo tecnico TypeScript",
        cvJson: {
          summary: "Profilo tecnico",
          skills: ["TypeScript", "React"],
        },
      },
    });
  });

  it("applies analyzed CV data to the authenticated user's profile", async () => {
    await request(app())
      .post("/api/profile-vision/analyze-cv")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        fileDataUrl: "data:image/png;base64,ZmFrZQ==",
        apply: true,
      })
      .expect(200);

    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it("returns degraded when no vision plugin is registered", async () => {
    getBestMock.mockReturnValue(undefined);

    const response = await request(app())
      .post("/api/profile-vision/analyze-cv")
      .set("Authorization", `Bearer ${token()}`)
      .send({ fileDataUrl: "data:image/png;base64,ZmFrZQ==" })
      .expect(503);

    expect(response.body).toMatchObject({ status: "unavailable" });
  });
});
