import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const statusMock = vi.hoisted(() => vi.fn());
const memoryMock = vi.hoisted(() => vi.fn());
const messageMock = vi.hoisted(() => vi.fn());
const syncMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("../lib/openhuman-client", () => ({
  getOpenHumanStatus: statusMock,
  searchOpenHumanMemory: memoryMock,
  sendOpenHumanMessage: messageMock,
  startOpenHumanSync: syncMock,
}));

vi.mock("@workspace/db", () => ({
  usersTable: { clerkId: "clerkId" },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
  },
}));

import openhumanRouter from "./openhuman";

type MemoryRouteBody = {
  results: Array<{ source: "openhuman" }>;
};

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
  instance.use(express.json());
  instance.use("/api/openhuman", openhumanRouter);
  return instance;
}

describe("openhuman routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires auth", async () => {
    await request(app()).get("/api/openhuman/status").expect(401);
  });

  it("returns degraded status when feature is disabled", async () => {
    statusMock.mockResolvedValue({
      enabled: false,
      state: "disabled",
      configured: false,
      coreUrl: null,
      checkedAt: "2026-05-21T00:00:00.000Z",
    });

    const response = await request(app())
      .get("/api/openhuman/status")
      .set("Authorization", `Bearer ${token()}`)
      .expect(503);

    expect(response.body).toMatchObject({ state: "disabled" });
  });

  it("returns memory results marked as openhuman", async () => {
    memoryMock.mockResolvedValue([
      {
        id: "m1",
        title: "Note",
        content: "Personal context",
        score: 0.8,
        source: "openhuman",
        url: null,
        updatedAt: null,
      },
    ]);

    const response = await request(app())
      .get("/api/openhuman/memory?q=note")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(memoryMock).toHaveBeenCalledWith("note", 42);
    const body = response.body as MemoryRouteBody;
    expect(body.results[0]).toMatchObject({ source: "openhuman" });
  });

  it("validates message payloads and proxies messages", async () => {
    await request(app())
      .post("/api/openhuman/message")
      .set("Authorization", `Bearer ${token()}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ message: "" }))
      .expect(400);

    messageMock.mockResolvedValue({ message: "ok", sources: [] });
    const response = await request(app())
      .post("/api/openhuman/message")
      .set("Authorization", `Bearer ${token()}`)
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ message: "ciao" }))
      .expect(200);

    expect(messageMock).toHaveBeenCalledWith("ciao", 42);
    expect(response.body).toEqual({ message: "ok", sources: [] });
  });

  it("starts sync for the authenticated user", async () => {
    syncMock.mockResolvedValue({ status: "started", message: "sync" });

    const response = await request(app())
      .post("/api/openhuman/sync")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(syncMock).toHaveBeenCalledWith(42);
    expect(response.body).toEqual({ status: "started", message: "sync" });
  });
});
