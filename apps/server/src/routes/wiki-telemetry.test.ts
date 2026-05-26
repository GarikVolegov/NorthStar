import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAiCallMock = vi.hoisted(() => vi.fn<(input: Record<string, unknown>) => void>());

vi.mock("@workspace/ai-server", () => ({
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
  estimateCost: vi.fn(() => 0.001),
  recordAiCall: recordAiCallMock,
}));

import {
  recordWikiInternalError,
  recordWikiStreamError,
  recordWikiSuccess,
} from "./wiki-telemetry";

describe("wiki telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records successful Wiki calls with usage, role, phase, and RAG metadata", () => {
    const result = recordWikiSuccess({
      requestId: "wiki-req-1",
      userId: 7,
      message: "ciao",
      historyLength: 2,
      startedAt: Date.now() - 10,
      fullResponse: "Risposta wiki",
      sourceChunks: [{ content: "chunk", source: "settori", score: 0.91 }],
      doneEvent: {
        type: "done",
        model: "llama-3.3-70b-versatile",
        reason: "wiki-chat:micro",
        contextSources: ["rag"],
        usage: { inputTokens: 20, outputTokens: 3, costUsdEst: 0.0001 },
        rag: { chunksRetrieved: 1, topSimilarity: 0.91, sourcesUsed: ["settori"] },
      },
    });

    expect(result).toMatchObject({
      model: "llama-3.3-70b-versatile",
      reason: "wiki-chat:micro",
      contextSources: ["rag"],
      usage: { inputTokens: 20, outputTokens: 3, costUsdEst: 0.0001 },
    });
    expect(recordAiCallMock).toHaveBeenCalledWith(expect.objectContaining({
      requestId: "wiki-req-1",
      userId: 7,
      intent: "wiki_chat",
      role: "wiki",
      phase: "chat",
      tier: "micro",
      status: "success",
      responseCategory: "success",
      searchMode: "semantic",
      ragChunksRetrieved: 1,
      ragTopSimilarity: 0.91,
      ragSourcesUsed: ["settori"],
    }));
  });

  it("records model and internal errors with Wiki status codes", () => {
    const base = {
      requestId: "wiki-req-2",
      userId: 7,
      message: "ciao",
      historyLength: 0,
      startedAt: Date.now() - 10,
    };

    recordWikiStreamError({
      ...base,
      event: { type: "error", message: "Errore", model: "llama-3.3-70b-versatile" },
      sourceChunks: [{ content: "chunk", source: "settori", score: 0.91 }],
    });
    recordWikiInternalError(base);

    expect(recordAiCallMock).toHaveBeenNthCalledWith(1, expect.objectContaining({
      role: "wiki",
      phase: "chat",
      status: "error_model",
      errorCode: "wiki_stream_error",
      model: "llama-3.3-70b-versatile",
      ragChunksRetrieved: 1,
    }));
    expect(recordAiCallMock).toHaveBeenNthCalledWith(2, expect.objectContaining({
      role: "wiki",
      phase: "chat",
      status: "error_internal",
      errorCode: "wiki_internal_error",
      model: "unknown",
    }));
  });
});
