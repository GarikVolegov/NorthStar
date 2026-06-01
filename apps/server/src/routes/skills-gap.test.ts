import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

const sectorRows = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));
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
}));

vi.mock("@workspace/db", () => ({
  sectorsTable: {
    id: "sectors.id",
    isActive: "sectors.is_active",
    skills: "sectors.skills",
  },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => sectorRows.rows),
        })),
      })),
    })),
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn(() => "and"),
  eq: vi.fn(() => "eq"),
}));

vi.mock("@workspace/ai-server/llm/client", () => ({
  getLLM: vi.fn(() => ({ chat: chatMock })),
}));

vi.mock("@workspace/ai-server", () => ({
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  recordLlmUsage: vi.fn(),
}));

import skillsGapRouter from "./skills-gap";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/skills-gap", skillsGapRouter);
  return instance;
}

function parseSse(text: string) {
  return text
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice("data: ".length)) as Record<string, unknown>);
}

describe("skills-gap stream route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sectorRows.rows = [
      { id: 3, name: "Data Analysis", skills: ["SQL"], isActive: true },
    ];
  });

  it("emits a recoverable SSE error instead of a silent done event when the provider returns no tokens", async () => {
    chatMock.mockResolvedValue((async function* () {})());

    const response = await request(app())
      .post("/api/skills-gap/analyze")
      .send({ sectorId: 3, userSkills: ["SQL"], experienceLevel: "junior" })
      .expect(200);

    const events = parseSse(response.text);

    expect(events).toEqual([
      expect.objectContaining({
        type: "error",
        code: "empty_stream",
        retryable: true,
      }),
    ]);
    expect(events.some((event) => event.type === "done")).toBe(false);
  });
});
