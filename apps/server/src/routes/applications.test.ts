import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import applicationsRouter from "./applications";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "autonomo",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/applications", applicationsRouter);
  return instance;
}

describe("applications routes", () => {
  it("returns an explicit empty list state", async () => {
    const response = await request(app())
      .get("/api/applications/42")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      applications: [],
      status: "empty",
      totalCount: 0,
    });
  });

  it("rejects requests for another user's applications instead of returning an ambiguous empty state", async () => {
    const response = await request(app())
      .get("/api/applications/7")
      .set("Authorization", `Bearer ${token()}`)
      .expect(403);

    expect(response.body).toEqual({
      code: "APPLICATIONS_USER_MISMATCH",
      error: "Puoi consultare solo le tue candidature",
    });
  });
});
