import express, { type NextFunction, type Request, type Response } from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Middleware = (req: Request, res: Response, next: NextFunction) => void;
type WikiEvent = {
  type: "token" | "done" | "error" | "sources";
  value?: string;
  message?: string;
  chunks?: Array<{ content: string; source: string; score: number }>;
  model?: string;
  reason?: string;
  contextSources?: string[];
  usage?: { inputTokens: number; outputTokens: number; costUsdEst: number };
  rag?: { chunksRetrieved: number; topSimilarity: number | null; sourcesUsed: string[] };
};

const costGuardMock = vi.hoisted(() => vi.fn<Middleware>());
const streamWikiResponseMock = vi.hoisted(() => vi.fn<() => AsyncGenerator<WikiEvent>>());
const suggestFollowUpQuestionsMock = vi.hoisted(() => vi.fn<() => Promise<string[]>>());
const recordAiCallMock = vi.hoisted(() => vi.fn<(input: Record<string, unknown>) => void>());
const selectMock = vi.hoisted(() => vi.fn<() => unknown>());
const buildWikiLLMContextMock = vi.hoisted(() => vi.fn());

vi.mock("../middleware/auth", () => ({
  requireAuth: vi.fn<Middleware>((req, _res, next) => {
    req.user = {
      id: 7,
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
  costGuard: costGuardMock,
}));

vi.mock("../lib/wikillm-context-router", () => ({
  buildWikiLLMContext: buildWikiLLMContextMock,
}));

vi.mock("@workspace/ai-server", () => ({
  streamWikiResponse: streamWikiResponseMock,
  suggestFollowUpQuestions: suggestFollowUpQuestionsMock,
  recordAiCall: recordAiCallMock,
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  estimateCost: vi.fn(() => 0.001),
}));

vi.mock("@workspace/db", () => ({
  db: { select: selectMock },
  usersTable: { id: "users.id", journeyType: "users.journey_type" },
  userProfileSettingsTable: {
    userId: "profile.user_id",
    workPreference: "profile.work_preference",
    cvText: "profile.cv_text",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq"),
}));

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/wiki", wikiRouter);
  return instance;
}

import wikiRouter from "./wiki";

describe("wiki routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    suggestFollowUpQuestionsMock.mockResolvedValue([]);
    buildWikiLLMContextMock.mockResolvedValue({
      context: "",
      contexts: { semanticMemory: "", openHuman: "", graphify: "", wendyBrain: "" },
      sources: [],
    });
    selectMock.mockReturnValue({
      from: () => ({
        leftJoin: () => ({
          where: () => ({
            limit: async () => [{
              journeyType: "career",
              workPreference: "remote",
              cvText: "typescript",
            }],
          }),
        }),
      }),
    });
  });

  it("runs cost guard before opening the Wiki stream", async () => {
    costGuardMock.mockImplementation((_req, res) => {
      res.status(403).json({ code: "COST_LIMIT_EXCEEDED" });
    });

    await request(app())
      .post("/api/wiki/3/ask")
      .send({ message: "ciao" })
      .expect(403);

    expect(costGuardMock).toHaveBeenCalledOnce();
    expect(streamWikiResponseMock).not.toHaveBeenCalled();
  });

  it("records Wiki success telemetry with usage and RAG metadata", async () => {
    costGuardMock.mockImplementation((_req, _res, next) => next());
    streamWikiResponseMock.mockReturnValue((async function* () {
      yield { type: "sources", chunks: [{ content: "chunk", source: "settori", score: 0.91 }] };
      yield { type: "token", value: "Risposta" };
      yield {
        type: "done",
        model: "llama-3.3-70b-versatile",
        reason: "wiki-chat:micro",
        contextSources: ["rag"],
        usage: { inputTokens: 20, outputTokens: 3, costUsdEst: 0.0001 },
        rag: { chunksRetrieved: 1, topSimilarity: 0.91, sourcesUsed: ["settori"] },
      };
    })());

    await request(app())
      .post("/api/wiki/3/ask")
      .send({ message: "ciao" })
      .expect(200);

    expect(recordAiCallMock).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "wiki_chat",
        role: "wiki",
        phase: "chat",
        model: "llama-3.3-70b-versatile",
        tier: "micro",
        status: "success",
        searchMode: "semantic",
        ragChunksRetrieved: 1,
        ragTopSimilarity: 0.91,
        ragSourcesUsed: ["settori"],
      }),
    );
  });

  it("passes federated context into the Wiki stream", async () => {
    costGuardMock.mockImplementation((_req, _res, next) => next());
    buildWikiLLMContextMock.mockResolvedValue({
      context: "\n\n## Graphify codice\n1. wiki route",
      contexts: {
        semanticMemory: "",
        openHuman: "",
        graphify: "\n\n## Graphify codice\n1. wiki route",
        wendyBrain: "",
      },
      sources: ["graphify", "wendy-brain"],
    });
    streamWikiResponseMock.mockReturnValue((async function* () {
      yield {
        type: "done",
        model: "llama-3.3-70b-versatile",
        reason: "wiki-chat:micro",
        contextSources: ["graphify", "wendy-brain"],
        usage: { inputTokens: 20, outputTokens: 0, costUsdEst: 0 },
        rag: { chunksRetrieved: 0, topSimilarity: null, sourcesUsed: [] },
      };
    })());

    await request(app())
      .post("/api/wiki/3/ask")
      .send({ message: "dove sta il codice wiki?" })
      .expect(200);

    expect(buildWikiLLMContextMock).toHaveBeenCalledWith(expect.objectContaining({
      query: "dove sta il codice wiki?",
      userId: 7,
      includeWendyBrain: true,
      graphifyProfile: "auto",
    }));
    expect(streamWikiResponseMock).toHaveBeenCalledWith(expect.objectContaining({
      externalContext: {
        text: "\n\n## Graphify codice\n1. wiki route",
        sources: ["graphify", "wendy-brain"],
      },
    }));
  });

  it("records Wiki stream errors without exposing internal details", async () => {
    costGuardMock.mockImplementation((_req, _res, next) => next());
    streamWikiResponseMock.mockReturnValue((async function* () {
      yield { type: "error", message: "Errore durante la generazione della risposta" };
    })());

    const response = await request(app())
      .post("/api/wiki/3/ask")
      .send({ message: "ciao" })
      .expect(200);

    expect(response.text).toContain("Errore durante la generazione della risposta");
    expect(recordAiCallMock).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "wiki_chat",
        role: "wiki",
        phase: "chat",
        status: "error_model",
        errorCode: "wiki_stream_error",
      }),
    );
  });

  it("emits a recoverable error when the Wiki provider closes without tokens", async () => {
    costGuardMock.mockImplementation((_req, _res, next) => next());
    streamWikiResponseMock.mockReturnValue((async function* () {
      yield {
        type: "done",
        model: "llama-3.3-70b-versatile",
        reason: "wiki-chat:micro",
        contextSources: [],
        usage: { inputTokens: 20, outputTokens: 0, costUsdEst: 0 },
        rag: { chunksRetrieved: 0, topSimilarity: null, sourcesUsed: [] },
      };
    })());

    const response = await request(app())
      .post("/api/wiki/3/ask")
      .send({ message: "ciao" })
      .expect(200);

    expect(response.text).toContain('"type":"error"');
    expect(response.text).toContain('"code":"empty_stream"');
    expect(response.text).not.toContain('"type":"done"');
  });
});
