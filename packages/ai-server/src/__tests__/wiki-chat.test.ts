import { beforeEach, describe, expect, it, vi } from "vitest";

const retrieveMock = vi.hoisted(() => vi.fn());
const chatMock = vi.hoisted(() => vi.fn());
const selectModelForMock = vi.hoisted(() => vi.fn());

vi.mock("../growth-agent/retriever", () => ({
  retrieve: retrieveMock,
}));

vi.mock("../llm/client", () => ({
  getLLM: vi.fn(() => ({ chat: chatMock })),
}));

vi.mock("../model-router", () => ({
  selectModelFor: selectModelForMock,
}));

vi.mock("../logger", () => ({
  logger: { error: vi.fn() },
}));

import { streamWikiResponse } from "../wiki/chat";
import type { WikiStreamEvent } from "../wiki/chat";

describe("streamWikiResponse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    retrieveMock.mockResolvedValue([
      {
        id: 1,
        content: "Contesto professionale molto utile per la risposta.",
        source: "settori",
        sourceType: "platform_content",
        score: 0.91,
        metadata: {},
      },
    ]);
    selectModelForMock.mockReturnValue({
      model: "llama-3.3-70b-versatile",
      provider: "groq",
      temperature: 0.6,
      maxTokens: 600,
      reason: "wiki-chat:micro",
    });
    chatMock.mockResolvedValue((async function* () {
      yield "Risposta ";
      yield "wiki";
    })());
  });

  it("emits sources and a done event with routing, usage, and RAG provenance", async () => {
    const events: WikiStreamEvent[] = [];

    for await (const event of streamWikiResponse({
      userId: 7,
      sectorId: 3,
      sectorName: "Marketing",
      message: "Quali competenze servono?",
    })) {
      events.push(event);
    }

    expect(events[0]).toMatchObject({
      type: "sources",
      chunks: [{ source: "settori", score: 0.91 }],
    });
    const done = events.at(-1);
    expect(done).toMatchObject({
      type: "done",
      model: "llama-3.3-70b-versatile",
      reason: "wiki-chat:micro",
      contextSources: ["rag"],
      rag: {
        chunksRetrieved: 1,
        topSimilarity: 0.91,
        sourcesUsed: ["settori"],
      },
    });
    expect(done?.usage?.inputTokens).toBeGreaterThan(0);
    expect(done?.usage?.outputTokens).toBeGreaterThan(0);
    expect(done?.usage?.costUsdEst).toBeGreaterThanOrEqual(0);
  });

  it("adds bounded profile context and only the latest history turns to the prompt", async () => {
    retrieveMock.mockResolvedValue([]);
    const cvText = `${"a".repeat(300)}TAIL`;
    const history = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `history-${index}`,
    }));

    for await (const _event of streamWikiResponse({
      userId: 7,
      sectorId: 3,
      sectorName: "Marketing",
      journeyType: "career",
      workPreference: "remote",
      cvText,
      history,
      message: "Quali competenze servono?",
    })) {
      // Drain the stream so the LLM call is executed.
    }

    const messages = chatMock.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    expect(messages[0]?.content).toContain("Tipo percorso: career");
    expect(messages[0]?.content).toContain("Preferenza lavoro: remote");
    expect(messages[0]?.content).toContain(`Competenze da CV: ${"a".repeat(300)}`);
    expect(messages[0]?.content).not.toContain("TAIL");
    expect(messages.map((message) => message.content)).not.toContain("history-0");
    expect(messages.map((message) => message.content)).not.toContain("history-1");
    expect(messages.map((message) => message.content)).toEqual(expect.arrayContaining([
      "history-2",
      "history-3",
      "history-4",
      "history-5",
      "history-6",
      "history-7",
      "Quali competenze servono?",
    ]));
  });

  it("injects external federated context and reports its sources", async () => {
    retrieveMock.mockResolvedValue([]);

    const events: WikiStreamEvent[] = [];
    for await (const event of streamWikiResponse({
      userId: 7,
      sectorId: 3,
      sectorName: "Marketing",
      message: "Come funziona la WikiLLM?",
      externalContext: {
        text: "\n\n## Graphify codice\n1. streamWikiResponse usa il router federato",
        sources: ["graphify", "wendy-brain"],
      },
    })) {
      events.push(event);
    }

    const messages = chatMock.mock.calls[0]?.[0] as Array<{ role: string; content: string }>;
    expect(messages[0]?.content).toContain("Graphify codice");
    expect(events.at(-1)).toMatchObject({
      type: "done",
      contextSources: ["graphify", "wendy-brain"],
      rag: {
        chunksRetrieved: 0,
        topSimilarity: null,
        sourcesUsed: [],
      },
    });
  });
});
