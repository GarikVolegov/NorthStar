import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createMemoryRoutinesStore, createRoutinesRouter } from "./routines";

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
      journeyType: "investitore",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/routines", createRoutinesRouter({ store: createMemoryRoutinesStore() }));
  return instance;
}

describe("routines routes", () => {
  it("creates a weekly market report routine with vital signs enabled", async () => {
    const server = app();
    const response = await request(server)
      .post("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        type: "market_report",
        name: "Monitor Tecnologia",
        schedule: "weekly",
        parameters: { sectorId: 7, includeVitals: true, geography: "IT" },
        outputChannel: "wendy_context",
      })
      .expect(201);

    expect(response.body.routine).toMatchObject({
      userId: 42,
      type: "market_report",
      schedule: "weekly",
      parameters: { sectorId: 7, includeVitals: true, geography: "IT" },
    });

    const list = await request(server)
      .get("/api/routines")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);
    expect(list.body.meta.activeCount).toBe(1);
    expect(list.body.routines).toHaveLength(1);
  });
});
