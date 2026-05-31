import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
  calendarEventsTable: {
    userId: "calendar_events.user_id",
  },
}));

import calendarRouter from "./calendar";

function token(overrides: { stripeSubscriptionId?: string | null } = {}) {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: overrides.stripeSubscriptionId ?? null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/calendar", calendarRouter);
  return instance;
}

describe("calendar quota route", () => {
  it("requires authentication", async () => {
    await request(app()).get("/api/calendar/quota").expect(401);
  });

  it("returns free plan quota usage compatible with the calendar UI", async () => {
    const response = await request(app())
      .get("/api/calendar/quota")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      isPremium: false,
      eventCount: 0,
      eventLimit: expect.any(Number),
    });
    expect(response.body.eventLimit).toBeGreaterThan(0);
  });

  it("returns unlimited quota for users with a subscription marker", async () => {
    const response = await request(app())
      .get("/api/calendar/quota")
      .set("Authorization", `Bearer ${token({ stripeSubscriptionId: "sub_123" })}`)
      .expect(200);

    expect(response.body).toEqual({
      isPremium: true,
      eventCount: 0,
      eventLimit: null,
    });
  });
});
