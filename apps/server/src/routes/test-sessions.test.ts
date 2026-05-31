import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));

const testSessionsTableMock = vi.hoisted(() => ({
  id: "test_sessions.id",
  userId: "test_sessions.user_id",
  confirmedSectorId: "test_sessions.confirmed_sector_id",
}));

const sectorsTableMock = vi.hoisted(() => ({
  id: "sectors.id",
  isActive: "sectors.is_active",
}));

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: dbMock,
  usersTable: { clerkId: "users.clerk_id" },
  testSessionsTable: testSessionsTableMock,
  sectorsTable: sectorsTableMock,
}));

import testSessionsRouter, { publicTestSessionsRouter } from "./test-sessions";

function token(userId = 42) {
  return jwt.sign(
    {
      userId,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "dipendente",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/test-sessions", publicTestSessionsRouter);
  instance.use("/api/test-sessions", testSessionsRouter);
  return instance;
}

function selectRows(rows: unknown[]) {
  dbMock.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

function updateRows(rows: unknown[]) {
  const returning = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ returning });
  const set = vi.fn().mockReturnValue({ where });
  dbMock.update.mockReturnValueOnce({ set });
  return { set, where, returning };
}

describe("test sessions routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication before confirming a sector", async () => {
    await request(app())
      .post("/api/test-sessions/123/confirm")
      .send({ sectorId: 7 })
      .expect(401);
  });

  it("allows guests to read a public test result by numeric id", async () => {
    const session = { id: 123, userId: null, primaryTypes: ["Investigativo"] };
    selectRows([session]);

    const response = await request(app())
      .get("/api/test-sessions/123")
      .expect(200);

    expect(response.body).toEqual(session);
  });

  it("keeps personalized latest session protected from guests", async () => {
    await request(app())
      .get("/api/test-sessions/latest")
      .expect(401);
  });

  it("confirms an active sector on a session owned by the current user", async () => {
    selectRows([{ id: 7 }]);
    const session = {
      id: 123,
      userId: 42,
      confirmedSectorId: 7,
      recommendations: [],
    };
    const update = updateRows([session]);

    const response = await request(app())
      .post("/api/test-sessions/123/confirm")
      .set("Authorization", `Bearer ${token()}`)
      .send({ sectorId: 7 })
      .expect(200);

    expect(update.set).toHaveBeenCalledWith({ confirmedSectorId: 7 });
    expect(response.body).toEqual({ success: true, session });
  });

  it("does not confirm a missing or inactive sector", async () => {
    selectRows([]);

    const response = await request(app())
      .post("/api/test-sessions/123/confirm")
      .set("Authorization", `Bearer ${token()}`)
      .send({ sectorId: 7 })
      .expect(404);

    expect(response.body).toEqual({ error: "Settore non trovato o non attivo" });
    expect(dbMock.update).not.toHaveBeenCalled();
  });

  it("does not confirm a sector on another user's session", async () => {
    selectRows([{ id: 7 }]);
    updateRows([]);

    const response = await request(app())
      .post("/api/test-sessions/123/confirm")
      .set("Authorization", `Bearer ${token(99)}`)
      .send({ sectorId: 7 })
      .expect(404);

    expect(response.body).toEqual({ error: "Sessione non trovata" });
  });
});
