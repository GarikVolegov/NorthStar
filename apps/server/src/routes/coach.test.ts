import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

const selectRows = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
const updateSetMock = vi.hoisted(() => vi.fn());
const chatMock = vi.hoisted(() => vi.fn());

vi.mock("../middleware/auth", () => ({
  requireAuth: vi.fn<Middleware>((req, _res, next) => {
    req.user = {
      id: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      stripeSubscriptionId: null,
      journeyType: null,
      testSessionId: null,
      onboardingCompleted: true,
    };
    next();
  }),
}));

vi.mock("../middleware/rate-limit", () => ({
  wendyLimiter: vi.fn<Middleware>((_req, _res, next) => next()),
  wendyIpLimiter: vi.fn<Middleware>((_req, _res, next) => next()),
  planQuotaLimiter: vi.fn<Middleware>((_req, _res, next) => next()),
}));

vi.mock("../middleware/cost-guard", () => ({
  costGuard: vi.fn<Middleware>((_req, _res, next) => next()),
}));

vi.mock("../middleware/check-feature", () => ({
  getEffectivePlan: vi.fn(async () => "free"),
  planMeets: vi.fn(() => false),
}));

vi.mock("@workspace/db", () => {
  const coachSessionsTable = {
    id: "coach_sessions.id",
    userId: "coach_sessions.user_id",
    title: "coach_sessions.title",
    messages: "coach_sessions.messages",
    createdAt: "coach_sessions.created_at",
    updatedAt: "coach_sessions.updated_at",
  };
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
  return {
    coachSessionsTable,
    coachMemoryFactsTable,
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(async () => selectRows.rows),
            orderBy: vi.fn(async () => selectRows.rows),
          })),
          orderBy: vi.fn(async () => selectRows.rows),
        })),
      })),
      update: vi.fn(() => ({
        set: updateSetMock.mockImplementation(() => ({
          where: vi.fn(async () => undefined),
        })),
      })),
      insert: vi.fn(),
      delete: vi.fn(),
    },
  };
});

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  desc: vi.fn(() => "desc"),
  eq: vi.fn(() => "eq"),
  isNull: vi.fn(() => "isNull"),
}));

vi.mock("@workspace/ai-server/llm/client", () => ({
  getLLM: vi.fn(() => ({ chat: chatMock })),
}));

vi.mock("@workspace/ai-server", () => ({
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  recordLlmUsage: vi.fn(() => Promise.resolve()),
  selectModel: vi.fn(() => ({
    model: "test-model",
    temperature: 0.4,
    maxTokens: 800,
    reason: "test",
  })),
}));

vi.mock("@workspace/ai-server/growth-agent", () => ({
  buildMemorySection: vi.fn(() => ""),
  buildSessionHistorySection: vi.fn(() => ""),
  extractMemory: vi.fn(),
  loadMemory: vi.fn(async () => null),
  loadRecentSummaries: vi.fn(async () => []),
  mergeMemory: vi.fn(),
  summarizeSession: vi.fn(),
}));

import coachRouter from "./coach";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/coach", coachRouter);
  return instance;
}

function parseSse(text: string) {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)) as Record<string, unknown>);
}

describe("coach stream route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectRows.rows = [
      {
        id: 9,
        userId: 42,
        title: "Nuova sessione",
        messages: [],
        createdAt: new Date("2026-05-31T10:00:00.000Z"),
        updatedAt: new Date("2026-05-31T10:00:00.000Z"),
      },
    ];
  });

  it("does not save an empty assistant turn when the provider closes without tokens", async () => {
    chatMock.mockResolvedValue((async function* () {})());

    const response = await request(app())
      .post("/api/coach/sessions/9/ask")
      .send({ message: "Aiutami a scegliere il prossimo passo" })
      .expect(200);

    const events = parseSse(response.text);

    expect(events).toEqual([
      expect.objectContaining({
        type: "error",
        code: "empty_stream",
        retryable: true,
      }),
    ]);
    expect(updateSetMock).not.toHaveBeenCalled();
  });
});
