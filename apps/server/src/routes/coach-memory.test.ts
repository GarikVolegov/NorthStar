import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const selectRows = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const insertRows = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const updateRows = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const insertValuesMock = vi.hoisted(() => vi.fn());
const updateSetMock = vi.hoisted(() => vi.fn());

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => {
  const coachMemoryFactsTable = {
    id: "coach_memory_facts.id",
    userId: "coach_memory_facts.user_id",
    key: "coach_memory_facts.key",
    value: "coach_memory_facts.value",
    sourceSessionId: "coach_memory_facts.source_session_id",
    confirmedCount: "coach_memory_facts.confirmed_count",
    createdAt: "coach_memory_facts.created_at",
    updatedAt: "coach_memory_facts.updated_at",
    deletedAt: "coach_memory_facts.deleted_at",
  };
  const coachSessionsTable = {
    id: "coach_sessions.id",
    userId: "coach_sessions.user_id",
    title: "coach_sessions.title",
    messages: "coach_sessions.messages",
    createdAt: "coach_sessions.created_at",
    updatedAt: "coach_sessions.updated_at",
  };
  const usersTable = { clerkId: "users.clerkId" };

  function selectChain() {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(async () => selectRows.rows),
      limit: vi.fn(async () => selectRows.rows),
    };
    return chain;
  }

  return {
    coachMemoryFactsTable,
    coachSessionsTable,
    usersTable,
    db: {
      select: vi.fn(() => selectChain()),
      insert: vi.fn(() => ({
        values: insertValuesMock.mockImplementation(() => ({
          returning: vi.fn(async () => insertRows.rows),
        })),
      })),
      update: vi.fn(() => ({
        set: updateSetMock.mockImplementation(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => updateRows.rows),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    },
  };
});

import coachRouter from "./coach";

interface MemoryFactResponse {
  fact: {
    id: number;
    value: string;
    source: string;
    confirmedCount: number;
  };
}

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: null,
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/coach", coachRouter);
  return instance;
}

describe("coach memory routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows.rows = [];
    insertRows.rows = [];
    updateRows.rows = [];
  });

  it("lists authenticated user's Wendy memory facts", async () => {
    selectRows.rows = [
      {
        id: 1,
        key: "goal_main",
        value: "Diventare data analyst",
        confirmedCount: 2,
        sourceSessionId: 10,
        createdAt: new Date("2026-05-22T10:00:00.000Z"),
      },
    ];

    const response = await request(app())
      .get("/api/coach/memory")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toEqual({
      facts: [
        {
          id: 1,
          key: "goal_main",
          value: "Diventare data analyst",
          source: "conversation",
          confirmedCount: 2,
          createdAt: "2026-05-22T10:00:00.000Z",
        },
      ],
    });
  });

  it("adds manual memory facts with an explicit user-controlled source", async () => {
    insertRows.rows = [
      {
        id: 2,
        key: "user_manual_abc",
        value: "Preferisco studiare la sera",
        confirmedCount: 1,
        sourceSessionId: null,
        createdAt: new Date("2026-05-22T11:00:00.000Z"),
      },
    ];

    const response = await request(app())
      .post("/api/coach/memory")
      .set("Authorization", `Bearer ${token()}`)
      .send({ key: "user_manual", value: "Preferisco studiare la sera", source: "user_manual" })
      .expect(201);

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 42,
        value: "Preferisco studiare la sera",
        sourceSessionId: null,
      }),
    );
    const body = response.body as MemoryFactResponse;
    expect(body.fact).toMatchObject({
      id: 2,
      value: "Preferisco studiare la sera",
      source: "user_manual",
      confirmedCount: 1,
    });
  });

  it("soft deletes only the authenticated user's memory fact", async () => {
    updateRows.rows = [{ id: 2 }];

    await request(app())
      .delete("/api/coach/memory/2")
      .set("Authorization", `Bearer ${token()}`)
      .expect(204);

    const patch = updateSetMock.mock.calls[0]?.[0] as { deletedAt?: unknown };
    expect(patch.deletedAt).toBeInstanceOf(Date);
  });
});
