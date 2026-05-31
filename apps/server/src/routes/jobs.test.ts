import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import jobsRouter from "./jobs";

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
  instance.use("/api/jobs", jobsRouter);
  return instance;
}

describe("jobs routes", () => {
  it("returns an explicit empty job feed state", async () => {
    const response = await request(app())
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      jobs: [],
      basedOnSector: null,
      totalCount: 0,
      status: "empty",
    });
  });
});
