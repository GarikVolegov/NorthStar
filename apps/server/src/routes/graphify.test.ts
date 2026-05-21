import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const statusMock = vi.hoisted(() => vi.fn());
const searchMock = vi.hoisted(() => vi.fn());
const explainMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("../lib/graphify-client", () => ({
  getGraphifyStatus: statusMock,
  searchGraphify: searchMock,
  explainGraphifyNode: explainMock,
}));

vi.mock("@workspace/db", () => ({
  usersTable: { clerkId: "clerkId", id: "id", role: "role" },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ role: "admin" }]),
        })),
      })),
    })),
  },
}));

import graphifyRouter from "./graphify";

interface GraphifySearchBody {
  results: Array<{ source: "graphify" }>;
}

function token(role: "user" | "admin" = "admin") {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role,
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
  instance.use("/api/graphify", graphifyRouter);
  return instance;
}

describe("graphify routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires auth", async () => {
    await request(app()).get("/api/graphify/status").expect(401);
  });

  it("returns graphify status for admins", async () => {
    statusMock.mockResolvedValue({
      enabled: true,
      state: "ready",
      graphs: [],
      checkedAt: "2026-05-21T00:00:00.000Z",
    });

    const response = await request(app())
      .get("/api/graphify/status")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({ state: "ready" });
  });

  it("validates search query and returns graphify sources", async () => {
    searchMock.mockResolvedValue([
      {
        id: "auth",
        graph: "apps",
        label: "Auth Route",
        source: "graphify",
        sourceFile: "apps/server/src/routes/auth.ts",
        sourceLocation: null,
        community: "2",
        score: 2,
        neighbors: [],
      },
    ]);

    await request(app())
      .get("/api/graphify/search")
      .set("Authorization", `Bearer ${token()}`)
      .expect(400);

    const response = await request(app())
      .get("/api/graphify/search?q=auth")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(searchMock).toHaveBeenCalledWith("auth");
    const body = response.body as GraphifySearchBody;
    expect(body.results[0]).toMatchObject({ source: "graphify" });
  });

  it("explains a graph node", async () => {
    explainMock.mockResolvedValue({
      id: "auth",
      graph: "apps",
      label: "Auth Route",
      source: "graphify",
      sourceFile: "apps/server/src/routes/auth.ts",
      sourceLocation: null,
      community: "2",
      score: 1,
      neighbors: [],
    });

    const response = await request(app())
      .get("/api/graphify/explain?graph=apps&id=auth")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({ source: "graphify", id: "auth" });
  });
});
