import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockChatCreate = vi.hoisted(() => vi.fn());

vi.mock("@workspace/db", () => ({
  db: { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate },
  coachMemoryFactsTable: {},
  coachMemoryPatternsTable: {},
}));

vi.mock("../client", () => ({
  openai: {
    chat: {
      completions: {
        create: mockChatCreate,
      },
    },
  },
  resolveActiveProvider: () => "openai",
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("./embedder", () => ({
  embedText: vi.fn(async (text: string) => {
    const fake: number[] = new Array<number>(256).fill(0);
    const hash = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    fake[0] = hash / 1000;
    return fake;
  }),
}));

import {
  extractMemory,
  extractMemoryIncremental,
  mergeMemory,
  loadMemory,
  buildMemorySection,
} from "../growth-agent/memory-manager";

describe("extractMemory", () => {
  it("returns null when fewer than 2 user messages", async () => {
    const result = await extractMemory([
      { role: "user", content: "Ciao" },
      { role: "assistant", content: "Ciao!" },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when no user messages", async () => {
    const result = await extractMemory([]);
    expect(result).toBeNull();
  });

  it("returns extracted facts and patterns on success", async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        facts: [{ key: "job", value: "sviluppatore" }],
        patterns: [{ patternType: "strength", description: "è analitico" }],
      }) } }],
    });

    const result = await extractMemory([
      { role: "user", content: "Lavoro come sviluppatore" },
      { role: "assistant", content: "Capisco" },
      { role: "user", content: "Mi piace risolvere problemi" },
    ]);

    expect(result).not.toBeNull();
    expect(result!.facts).toHaveLength(1);
    expect(result!.facts[0]?.key).toBe("job");
    expect(result!.patterns).toHaveLength(1);
  });

  it("handles LLM failure gracefully", async () => {
    mockChatCreate.mockRejectedValueOnce(new Error("API error"));

    const result = await extractMemory([
      { role: "user", content: "Messaggio 1" },
      { role: "assistant", content: "Risposta 1" },
      { role: "user", content: "Messaggio 2" },
    ]);

    expect(result).toBeNull();
  });
});

describe("extractMemoryIncremental", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts from a single user/assistant delta when supervisor score is acceptable", async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        facts: [{ key: "goal_main", value: "cambiare carriera entro 12 mesi" }],
        patterns: [{ patternType: "growth_edge", description: "tende a rimandare decisioni grandi" }],
      }) } }],
    });

    const result = await extractMemoryIncremental(
      "Il mio obiettivo e cambiare carriera entro un anno, ma rimando sempre le decisioni grandi.",
      "Partiamo da una decisione piccola questa settimana.",
      0.8,
    );

    expect(result).not.toBeNull();
    expect(result?.facts[0]?.key).toBe("goal_main");
    expect(result?.patterns[0]?.patternType).toBe("growth_edge");
  });

  it("skips incremental extraction when supervisor score is too low", async () => {
    const result = await extractMemoryIncremental("Ciao", "Risposta mediocre", 0.2);

    expect(result).toBeNull();
    expect(mockChatCreate).not.toHaveBeenCalled();
  });
});

describe("loadMemory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads facts and patterns for a user", async () => {
    const mockFact = { id: 1, userId: 1, key: "job", value: "dev" };
    const mockPattern = { id: 1, userId: 1, patternType: "strength", description: "analitico", confidence: 0.7 };

    const whereFacts = vi.fn(() => Promise.resolve([mockFact]));
    const wherePatterns = vi.fn(() => Promise.resolve([mockPattern]));

    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: whereFacts })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: wherePatterns })) });

    const result = await loadMemory(1);
    expect(result.facts).toHaveLength(1);
    expect(result.patterns).toHaveLength(1);
  });

  it("filters patterns below confidence 0.5", async () => {
    const lowConfPattern = { id: 2, userId: 1, patternType: "strength", description: "impreciso", confidence: 0.3 };

    const whereFacts = vi.fn(() => Promise.resolve([]));
    const wherePatterns = vi.fn(() => Promise.resolve([lowConfPattern]));

    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: whereFacts })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: wherePatterns })) });

    const result = await loadMemory(1);
    expect(result.patterns).toHaveLength(0);
  });

  it("keeps Wendy available when one memory query fails because of schema drift", async () => {
    const mockFact = { id: 1, userId: 1, key: "job", value: "dev" };

    const whereFacts = vi.fn(() => Promise.resolve([mockFact]));
    const wherePatterns = vi.fn(() =>
      Promise.reject(new Error('column "last_reinforced_at" does not exist')),
    );

    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: whereFacts })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: wherePatterns })) });

    const result = await loadMemory(1);
    expect(result.facts).toHaveLength(1);
    expect(result.patterns).toHaveLength(0);
  });
});

describe("buildMemorySection", () => {
  it("returns empty string when no facts or patterns", () => {
    const result = buildMemorySection({ facts: [], patterns: [] });
    expect(result).toBe("");
  });

  it("includes facts section", () => {
    const result = buildMemorySection({
      facts: [{ id: 1, userId: 1, key: "job", value: "dev", confirmedCount: 1, sourceSessionId: 1, lastMentionedAt: new Date(), embedding: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }],
      patterns: [],
    });
    expect(result).toContain("Fatti biografici");
    expect(result).toContain("job");
  });

  it("includes patterns section with confidence labels", () => {
    const result = buildMemorySection({
      facts: [],
      patterns: [{ id: 1, userId: 1, patternType: "strength", description: "analitico", confidence: 0.7, observedCount: 2, sessionIds: [1], lastReinforcedAt: new Date(), decayScore: 1.0, embedding: null, createdAt: new Date(), updatedAt: new Date(), deletedAt: null }],
    });
    expect(result).toContain("Pattern comportamentali");
    expect(result).toContain("media confidence");
  });
});

describe("mergeMemory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips empty extractions", async () => {
    const whereFacts = vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) }));
    const wherePatterns = vi.fn(() => ({ limit: vi.fn(() => Promise.resolve([])) }));
    mockDbSelect
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: whereFacts })) })
      .mockReturnValueOnce({ from: vi.fn(() => ({ where: wherePatterns })) });

    await mergeMemory(1, 1, { facts: [], patterns: [] });
    // Should not call insert or update
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});
