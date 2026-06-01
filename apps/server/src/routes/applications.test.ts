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
  it("reports that applications persistence is not connected instead of pretending the list is empty", async () => {
    const response = await request(app())
      .get("/api/applications/42")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      applications: [],
      status: "not_configured",
      reason: "applications_persistence_not_connected",
      action: "connect_applications_persistence",
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

  it("fails a placeholder create with an unavailable status instead of reporting a persisted application", async () => {
    const response = await request(app())
      .post("/api/applications")
      .set("Authorization", `Bearer ${token()}`)
      .send({ company: "NorthStar", role: "UX Reliability" })
      .expect(503);

    expect(response.body).toEqual({
      status: "not_configured",
      reason: "applications_persistence_not_connected",
      action: "connect_applications_persistence",
    });
  });

  it("fails placeholder update and delete operations instead of reporting successful writes", async () => {
    const update = await request(app())
      .patch("/api/applications/1")
      .set("Authorization", `Bearer ${token()}`)
      .send({ status: "interview" })
      .expect(503);

    expect(update.body).toEqual({
      status: "not_configured",
      reason: "applications_persistence_not_connected",
      action: "connect_applications_persistence",
    });

    const deletion = await request(app())
      .delete("/api/applications/1")
      .set("Authorization", `Bearer ${token()}`)
      .expect(503);

    expect(deletion.body).toEqual({
      status: "not_configured",
      reason: "applications_persistence_not_connected",
      action: "connect_applications_persistence",
    });
  });
});
