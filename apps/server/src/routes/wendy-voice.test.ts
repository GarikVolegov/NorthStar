import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const wendyTextToSpeechMock = vi.hoisted(() => vi.fn());

vi.mock("../middleware/auth", () => ({
  optionalAuth: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization === "Bearer test-token") {
      req.user = {
        id: 42,
        email: "ada@example.com",
        name: "Ada",
        role: "user",
        onboardingCompleted: true,
        journeyType: "indeciso",
        stripeSubscriptionId: null,
        testSessionId: null,
      };
    }
    next();
  },
  requireAuth: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers.authorization !== "Bearer test-token") {
      res.status(401).json({ error: "Token mancante" });
      return;
    }
    req.user = {
      id: 42,
      email: "ada@example.com",
      name: "Ada",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: null,
      testSessionId: null,
    };
    next();
  },
}));

vi.mock("../middleware/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("../middleware/rate-limit", () => ({
  planQuotaLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  wendyIpLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  wendyLimiter: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../middleware/cost-guard", () => ({
  costGuard: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock("../middleware/check-feature", () => ({
  getEffectivePlan: vi.fn(async () => "free"),
  planMeets: vi.fn(() => false),
}));

vi.mock("@workspace/ai-server", () => ({
  estimateTokens: vi.fn(() => 0),
  recordLlmUsage: vi.fn(),
  selectModel: vi.fn(() => "gpt-4o-mini"),
  selectModelFor: vi.fn(() => ({ model: "gpt-4o-mini", reason: "test" })),
}));

vi.mock("@workspace/ai-server/audio", () => ({
  wendyTextToSpeech: wendyTextToSpeechMock,
}));

vi.mock("@workspace/ai-server/growth-agent/router-agent", () => ({
  routerAgent: vi.fn(),
}));

vi.mock("@workspace/ai-server/growth-agent/specialist-agent", () => ({
  getSpecialist: vi.fn(),
}));

vi.mock("@workspace/ai-server/growth-agent/retriever", () => ({
  retrieve: vi.fn(),
}));

vi.mock("@workspace/ai-server/growth-agent/memory-manager", () => ({
  buildMemorySection: vi.fn(() => ""),
  loadMemory: vi.fn(async () => null),
}));

import wendyRouter from "./wendy";

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use((req, _res, next) => {
    req.log = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    } as unknown as typeof req.log;
    next();
  });
  instance.use("/api/wendy", wendyRouter);
  return instance;
}

describe("Wendy voice route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wendyTextToSpeechMock.mockResolvedValue(Buffer.from("audio"));
  });

  it("requires authentication before generating TTS audio", async () => {
    await request(app())
      .post("/api/wendy/voice")
      .send({ text: "Ciao Wendy" })
      .expect(401);

    expect(wendyTextToSpeechMock).not.toHaveBeenCalled();
  });

  it("returns audio for authenticated users", async () => {
    const response = await request(app())
      .post("/api/wendy/voice")
      .set("Authorization", "Bearer test-token")
      .send({ text: "Ciao Wendy" })
      .expect(200);

    expect(response.headers["content-type"]).toContain("audio/ogg");
    expect(wendyTextToSpeechMock).toHaveBeenCalledWith("Ciao Wendy", "nova", "opus", undefined);
  });
});
