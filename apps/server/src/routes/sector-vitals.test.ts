import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createSectorVitalsRouter } from "./sector-vitals";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

const fakeVitals = {
  sectorId: 7,
  computedAt: "2026-05-28T10:00:00.000Z",
  geography: "IT",
  signs: {
    pulse: { key: "pulse", value: 10, status: "yellow", sparkline: Array(12).fill(10), delta: 0, source: "job" },
    oxygen: { key: "oxygen", value: 10, status: "yellow", sparkline: Array(12).fill(10), delta: 0, source: "role" },
    temperature: { key: "temperature", value: 10, status: "green", sparkline: Array(12).fill(10), delta: 0, source: "news" },
    pressure: { key: "pressure", value: 10, status: "green", sparkline: Array(12).fill(10), delta: 0, source: "pressure" },
    adrenaline: { key: "adrenaline", value: 10, status: "red", sparkline: Array(12).fill(10), delta: 0, source: "weak" },
  },
} as const;

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
  instance.use(
    "/api/sectors",
    createSectorVitalsRouter({
      compute: vi.fn(async () => fakeVitals),
      summarize: vi.fn(async () => "Settore in espansione moderata, con pressione controllata."),
    }),
  );
  return instance;
}

describe("sector vitals routes", () => {
  it("rejects invalid sector ids", async () => {
    await request(app()).get("/api/sectors/nope/vitals").expect(400);
  });

  it("returns five sector vital signs", async () => {
    const response = await request(app()).get("/api/sectors/7/vitals?geography=IT").expect(200);

    expect(response.body.sectorId).toBe(7);
    expect(Object.keys(response.body.signs)).toHaveLength(5);
    expect(response.body.signs.pulse.sparkline).toHaveLength(12);
  });

  it("generates an authenticated Wendy summary", async () => {
    const response = await request(app())
      .post("/api/sectors/7/vitals/summary")
      .set("Authorization", `Bearer ${token()}`)
      .send({ geography: "IT" })
      .expect(200);

    expect(response.body.summary).toContain("espansione moderata");
  });
});
