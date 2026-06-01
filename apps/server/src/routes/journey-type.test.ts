import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateSetMock = vi.hoisted(() => vi.fn());
const updateWhereMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/ai-server", () => ({
  invalidateUserFeedCache: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  usersTable: {
    id: "users.id",
    journeyType: "users.journey_type",
    journeyDecidedAt: "users.journey_decided_at",
    journeyDecisionSource: "users.journey_decision_source",
    updatedAt: "users.updated_at",
  },
  db: {
    update: vi.fn(() => ({
      set: updateSetMock,
    })),
  },
}));

import journeyTypeRouter from "./journey-type";

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/journey-type", journeyTypeRouter);
  return instance;
}

describe("journey-type decision persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSetMock.mockReturnValue({ where: updateWhereMock });
    updateWhereMock.mockResolvedValue(undefined);
  });

  it("sets decision metadata when saving a non-indeciso journey", async () => {
    const response = await request(app())
      .patch("/api/journey-type/me/journey-type")
      .set("Authorization", `Bearer ${token()}`)
      .send({ journeyType: "dipendente" })
      .expect(200);

    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({
      journeyType: "dipendente",
      journeyDecidedAt: expect.any(Date),
      journeyDecisionSource: "percorso_page",
      updatedAt: expect.any(Date),
    }));
    expect(response.body).toMatchObject({
      success: true,
      journeyType: "dipendente",
      journeyDecisionSource: "percorso_page",
    });
    expect(response.body.journeyDecidedAt).toEqual(expect.any(String));
  });

  it("clears decision metadata when returning to indeciso", async () => {
    const response = await request(app())
      .patch("/api/journey-type/me/journey-type")
      .set("Authorization", `Bearer ${token()}`)
      .send({ journeyType: "indeciso" })
      .expect(200);

    expect(updateSetMock).toHaveBeenCalledWith(expect.objectContaining({
      journeyType: "indeciso",
      journeyDecidedAt: null,
      journeyDecisionSource: null,
      updatedAt: expect.any(Date),
    }));
    expect(response.body).toMatchObject({
      success: true,
      journeyType: "indeciso",
      journeyDecidedAt: null,
      journeyDecisionSource: null,
    });
  });
});
