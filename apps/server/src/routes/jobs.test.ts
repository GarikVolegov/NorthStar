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
  it("reports that the job provider is not connected instead of pretending the feed is empty", async () => {
    const response = await request(app())
      .get("/api/jobs")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      jobs: [],
      basedOnSector: null,
      totalCount: 0,
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
    });
  });

  it("does not return a fake job detail when the provider is not connected", async () => {
    const response = await request(app())
      .get("/api/jobs/123")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
    });
  });

  it("fails placeholder job writes with an unavailable status instead of reporting successful persistence", async () => {
    const create = await request(app())
      .post("/api/jobs")
      .set("Authorization", `Bearer ${token()}`)
      .send({ title: "Designer", company: "NorthStar" })
      .expect(503);

    expect(create.body).toEqual({
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
    });

    const update = await request(app())
      .patch("/api/jobs/1")
      .set("Authorization", `Bearer ${token()}`)
      .send({ title: "Senior Designer" })
      .expect(503);

    expect(update.body).toEqual({
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
    });

    const deletion = await request(app())
      .delete("/api/jobs/1")
      .set("Authorization", `Bearer ${token()}`)
      .expect(503);

    expect(deletion.body).toEqual({
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
    });
  });
});
