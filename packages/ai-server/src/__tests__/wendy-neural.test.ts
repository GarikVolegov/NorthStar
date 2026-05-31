import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.hoisted(() => vi.fn(() => ({
  onConflictDoUpdate: vi.fn(() => ({
    returning: vi.fn(async () => [{ id: 77 }]),
  })),
  returning: vi.fn(async () => [{ id: 42 }]),
})));
const insertMock = vi.hoisted(() => vi.fn(() => ({ values: insertValues })));
const updateWhere = vi.hoisted(() => vi.fn(async () => undefined));
const updateSet = vi.hoisted(() => vi.fn(() => ({ where: updateWhere })));
const updateMock = vi.hoisted(() => vi.fn(() => ({ set: updateSet })));

const searchWendyBrainMock = vi.hoisted(() => vi.fn(async () => [
  {
    id: 3,
    type: "policy",
    title: "RAG policy",
    content: "Preferisci search_brain per domande interne.",
    status: "active",
    confidence: 0.9,
    importance: 0.8,
    metadata: {},
    sourceType: "manual",
    sourceRef: "policy-rag",
    score: 0.7,
  },
]));
const searchMemoryMock = vi.hoisted(() => vi.fn(async () => [
  {
    id: 9,
    type: "fact",
    title: "goal_main",
    content: "Vuole capire il RAG di NorthStar.",
    score: 0.65,
  },
]));
const handleSearchBrainMock = vi.hoisted(() => vi.fn(async () => ({
  ok: true,
  data: {
    chunks: [
      {
        content: "La pipeline RAG usa rag_sources e rag_chunks.",
        obsidianPath: ".brain/20_Product/Subsystems/RAG-Pipeline.md",
        sectors: ["L3"],
        roles: ["product"],
        similarity: 0.86,
        trustScore: 0.92,
      },
    ],
  },
})));
const getToolsForIntentMock = vi.hoisted(() => vi.fn(() => [
  {
    name: "search_brain",
    description: "Cerca nel cervello interno di NorthStar.",
    parameters: [],
  },
  {
    name: "search_rag",
    description: "Cerca dati esterni di mercato.",
    parameters: [],
  },
]));

vi.mock("@workspace/db", () => ({
  db: {
    insert: insertMock,
    update: updateMock,
  },
  wendyNeuralActivationsTable: {
    id: "id",
    requestId: "request_id",
    itemKind: "item_kind",
    itemRef: "item_ref",
    selected: "selected",
  },
  wendyNeuralEdgesTable: {
    id: "id",
    sourceItemKind: "source_item_kind",
    sourceItemRef: "source_item_ref",
    targetItemKind: "target_item_kind",
    targetItemRef: "target_item_ref",
    relationType: "relation_type",
    userId: "user_id",
    status: "status",
    weight: "weight",
    evidenceCount: "evidence_count",
    decayScore: "decay_score",
    updatedAt: "updated_at",
    lastReinforcedAt: "last_reinforced_at",
  },
}));

vi.mock("../wendy-brain", () => ({
  searchWendyBrain: searchWendyBrainMock,
  buildWendyBrainContextSection: vi.fn((hits: unknown[]) => hits.length ? "## Wendy Brain\n- policy" : ""),
}));

vi.mock("../growth-agent/memory-search", () => ({
  searchMemory: searchMemoryMock,
  buildContextualMemorySection: vi.fn((hits: unknown[]) => hits.length ? "## Memoria contestuale\n- goal_main" : ""),
}));

vi.mock("../wendy-router/tool-handlers-market", () => ({
  handleSearchBrain: handleSearchBrainMock,
}));

vi.mock("../wendy-router/tool-registry", () => ({
  getToolsForIntent: getToolsForIntentMock,
}));

vi.mock("../logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  buildNeuralPromptSection,
  buildWendyActivationContext,
  persistActivationTrace,
  reinforceCoActivations,
  scoreActivationCandidate,
} from "../wendy-neural";

describe("wendy-neural", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WENDY_NEURAL_ENABLED = "true";
    process.env.WENDY_NEURAL_MAX_ITEMS = "6";
  });

  it("scores activation candidates with the documented weighted formula", () => {
    const scored = scoreActivationCandidate({
      itemKind: "brain_note",
      itemRef: ".brain/20_Product/Subsystems/RAG-Pipeline.md",
      label: "RAG Pipeline",
      components: {
        semantic: 1,
        userRelevance: 0.5,
        graphProximity: 0.5,
        recency: 0,
        salience: 0.25,
        trust: 1,
      },
    });

    expect(scored.score).toBe(0.65);
  });

  it("builds an activation context from canonical sources without storing full messages", async () => {
    const context = await buildWendyActivationContext({
      requestId: "req-1",
      userId: 7,
      message: "spiegami la pipeline RAG",
      intent: "simple_qa",
      domain: "general",
      pageContext: { page: "dashboard", data: { selected: "rag" } },
    });

    expect(context.activeItems.map((item) => item.itemKind)).toContain("brain_note");
    expect(context.activeItems.map((item) => item.itemKind)).toContain("wendy_brain_node");
    expect(context.activeTools).toContain("search_brain");
    expect(context.promptSection).toContain("## Attivazione neurale Wendy");
    expect(context.activationSummary.items.length).toBeGreaterThan(0);

    await persistActivationTrace(context);
    const persistedRows = (insertValues.mock.calls as unknown as [[Array<Record<string, unknown>>]])[0][0];
    expect(JSON.stringify(persistedRows)).not.toContain("spiegami la pipeline RAG");
    expect(persistedRows[0]).toMatchObject({
      requestId: "req-1",
      messageHash: expect.any(String),
    });
  });

  it("reinforces co-activated edges without duplicating existing pairs", async () => {
    await reinforceCoActivations({
      userId: 7,
      requestId: "req-1",
      items: [
        { itemKind: "brain_note", itemRef: "brain:rag", label: "RAG", score: 0.9, selected: true },
        { itemKind: "tool", itemRef: "tool:search_brain", label: "search_brain", score: 0.8, selected: true },
        { itemKind: "tool", itemRef: "tool:search_rag", label: "search_rag", score: 0.2, selected: false },
      ],
    });

    expect(insertValues).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        sourceItemKind: "brain_note",
        sourceItemRef: "brain:rag",
        targetItemKind: "tool",
        targetItemRef: "tool:search_brain",
        relationType: "co_activated",
        userId: 7,
      }),
    ]));
  });

  it("returns an empty prompt section when disabled", async () => {
    process.env.WENDY_NEURAL_ENABLED = "false";
    const context = await buildWendyActivationContext({
      requestId: "req-disabled",
      userId: 7,
      message: "test",
      intent: "simple_qa",
    });

    expect(context.activeItems).toEqual([]);
    expect(buildNeuralPromptSection(context)).toBe("");
  });

  it("boosts search_rag above search_brain for labor-market questions", async () => {
    const context = await buildWendyActivationContext({
      requestId: "req-market",
      userId: 7,
      message: "quali sono i trend del mercato lavoro per data analyst in Italia?",
      intent: "deep_analysis",
      domain: "career",
    });

    const brain = context.activeItems.find((item) => item.itemRef === "tool:search_brain");
    const rag = context.activeItems.find((item) => item.itemRef === "tool:search_rag");
    expect(rag?.score).toBeGreaterThan(brain?.score ?? 0);
  });
});
