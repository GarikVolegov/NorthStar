import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMemoryObjectiveStore,
  createObjectivesRouter,
  type ObjectiveCertificateIssuer,
} from "./objectives";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

function token(journeyType = "investitore") {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType,
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app(issuer?: ObjectiveCertificateIssuer) {
  const instance = express();
  const routerOptions: Parameters<typeof createObjectivesRouter>[0] = {
    store: createMemoryObjectiveStore(),
  };
  if (issuer) routerOptions.certificateIssuer = issuer;
  instance.use(express.json());
  instance.use(
    "/api/objectives",
    createObjectivesRouter(routerOptions),
  );
  return instance;
}

describe("objective milestone certificates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds journey objectives as certifiable milestones", async () => {
    const response = await request(app())
      .post("/api/objectives/seed")
      .set("Authorization", `Bearer ${token("investitore")}`)
      .expect(201);

    expect(response.body.objectives).toHaveLength(3);
    expect(response.body.objectives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ isCertifiableMilestone: true }),
      ]),
    );
  });

  it("creates manual objectives as non-certifiable unless explicitly requested", async () => {
    const api = app();

    const manual = await request(api)
      .post("/api/objectives")
      .set("Authorization", `Bearer ${token()}`)
      .send({ text: "Preparare portfolio", category: "carriera" })
      .expect(201);
    expect(manual.body.isCertifiableMilestone).toBe(false);

    const milestone = await request(api)
      .post("/api/objectives")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        text: "Concludere percorso mercato",
        category: "analisi",
        isCertifiableMilestone: true,
      })
      .expect(201);
    expect(milestone.body.isCertifiableMilestone).toBe(true);
  });

  it("issues a certificate once when a certifiable milestone is completed", async () => {
    const issueMilestoneCertificate = vi.fn().mockResolvedValue({ id: 99 });
    const api = app({ issueMilestoneCertificate });

    const created = await request(api)
      .post("/api/objectives")
      .set("Authorization", `Bearer ${token()}`)
      .send({
        text: "Analizza 5 settori in crescita",
        category: "analisi",
        isCertifiableMilestone: true,
      })
      .expect(201);

    await request(api)
      .patch(`/api/objectives/${created.body.id}`)
      .set("Authorization", `Bearer ${token()}`)
      .send({ completed: true })
      .expect(200);

    await request(api)
      .patch(`/api/objectives/${created.body.id}`)
      .set("Authorization", `Bearer ${token()}`)
      .send({ completed: true })
      .expect(200);

    expect(issueMilestoneCertificate).toHaveBeenCalledTimes(1);
    expect(issueMilestoneCertificate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        userName: "Ada",
        objectiveId: created.body.id,
        objectiveText: "Analizza 5 settori in crescita",
        category: "analisi",
      }),
    );
  });

  it("does not issue a certificate for non-certifiable objectives", async () => {
    const issueMilestoneCertificate = vi.fn().mockResolvedValue({ id: 99 });
    const api = app({ issueMilestoneCertificate });

    const created = await request(api)
      .post("/api/objectives")
      .set("Authorization", `Bearer ${token()}`)
      .send({ text: "Fare una nota privata", category: "altro" })
      .expect(201);

    await request(api)
      .patch(`/api/objectives/${created.body.id}`)
      .set("Authorization", `Bearer ${token()}`)
      .send({ completed: true })
      .expect(200);

    expect(issueMilestoneCertificate).not.toHaveBeenCalled();
  });
});
