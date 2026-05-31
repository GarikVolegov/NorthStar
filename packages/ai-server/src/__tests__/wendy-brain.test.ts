import { beforeEach, describe, expect, it, vi } from "vitest";

const insertValues = vi.hoisted(() => vi.fn(() => ({
  onConflictDoUpdate: vi.fn(() => ({
    returning: vi.fn(async () => [{ id: 42, status: "candidate" }]),
  })),
})));
const insertMock = vi.hoisted(() => vi.fn(() => ({ values: insertValues })));
const updateWhere = vi.hoisted(() => vi.fn(async () => undefined));
const updateSet = vi.hoisted(() => vi.fn(() => ({ where: updateWhere })));
const updateMock = vi.hoisted(() => vi.fn(() => ({ set: updateSet })));
const selectLimit = vi.hoisted(() => vi.fn(async () => [
  {
    id: 1,
    type: "skill",
    title: "Career planning skill",
    content: "Helps Wendy build structured career plans.",
    status: "active",
    confidence: 0.92,
    importance: 0.8,
    metadata: { trigger: "career plan", tools: ["get_user_objectives"] },
    embedding: [1, 0, 0],
  },
  {
    id: 2,
    type: "style_rule",
    title: "Do not over-explain",
    content: "Keep first answer compact unless user asks for details.",
    status: "candidate",
    confidence: 0.9,
    importance: 0.7,
    metadata: {},
    embedding: [1, 0, 0],
  },
]));
const selectOrderBy = vi.hoisted(() => vi.fn(() => ({ limit: selectLimit })));
const selectWhere = vi.hoisted(() => vi.fn(() => ({ orderBy: selectOrderBy })));
const selectFrom = vi.hoisted(() => vi.fn(() => ({ where: selectWhere })));
const selectMock = vi.hoisted(() => vi.fn(() => ({ from: selectFrom })));
const registryAllMock = vi.hoisted(() => vi.fn(() => [
  {
    name: "get_salary_benchmark",
    description: "Recupera benchmark salariali per ruolo e geografia.",
    domains: ["career"],
    intents: ["planning"],
    parameters: [
      { name: "roleTitle", type: "string", description: "Titolo ruolo", required: true },
      { name: "geography", type: "string", description: "Area geografica" },
    ],
    isUiTool: false,
    requiresWrite: false,
  },
]));

vi.mock("@workspace/db", () => ({
  db: {
    insert: insertMock,
    update: updateMock,
    select: selectMock,
  },
  wendyBrainNodesTable: {
    id: "id",
    type: "type",
    title: "title",
    normalizedTitle: "normalized_title",
    content: "content",
    status: "status",
    confidence: "confidence",
    importance: "importance",
    sourceRef: "source_ref",
    metadata: "metadata",
    embedding: "embedding",
    lastReinforcedAt: "last_reinforced_at",
    updatedAt: "updated_at",
  },
  wendyBrainEventsTable: {
    id: "id",
  },
}));

vi.mock("../growth-agent/embedder", () => ({
  embedText: vi.fn(async () => [1, 0, 0]),
}));

vi.mock("../logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../wendy-router/tool-registry", () => ({}));

vi.mock("../tools/registry", () => ({
  toolRegistry: {
    all: registryAllMock,
  },
}));

import {
  buildWendyBrainContextSection,
  buildWendyBrainSkillPrompt,
  promoteWendyBrainCandidate,
  recordWendyBrainEvent,
  runWendyBrainOptimizer,
  sanitizeBrainText,
  searchWendyBrain,
} from "../wendy-brain";

describe("wendy-brain", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WENDY_BRAIN_ENABLED = "true";
    process.env.WENDY_BRAIN_MAX_CONTEXT_NODES = "1";
  });

  it("records candidate nodes with normalized dedupe keys and strips obvious PII", async () => {
    await recordWendyBrainEvent({
      type: "style_rule",
      title: "  Do Not Over-Explain! ",
      content: "Avoid collecting mario.rossi@gmail.com or +39 333 123 4567 in global brain.",
      sourceType: "admin_note",
      sourceRef: "note-1",
      confidence: 0.82,
      importance: 0.7,
    });

    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      type: "style_rule",
      title: "Do Not Over-Explain!",
      normalizedTitle: "do not over explain",
      status: "candidate",
      content: expect.not.stringContaining("mario.rossi@gmail.com"),
      sourceType: "admin_note",
      sourceRef: "note-1",
    }));
  });

  it("retrieves only active brain nodes by default and respects max context", async () => {
    const hits = await searchWendyBrain("career plan", { includeCandidates: false });

    expect(selectWhere).toHaveBeenCalled();
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      id: 1,
      type: "skill",
      title: "Career planning skill",
    });
  });

  it("formats skill nodes as knowledge, not executable tools", () => {
    const prompt = buildWendyBrainSkillPrompt({
      id: 1,
      type: "skill",
      title: "Career planning skill",
      content: "Helps Wendy build structured career plans.",
      status: "active",
      confidence: 0.92,
      importance: 0.8,
      metadata: { trigger: "career plan", tools: ["get_user_objectives"] },
      sourceType: "tool_registry",
      sourceRef: "career_planning",
      score: 0.9,
    });

    expect(prompt).toContain("Skill: Career planning skill");
    expect(prompt).toContain("Trigger: career plan");
    expect(prompt).toContain("Tool collegati: get_user_objectives");
    expect(prompt).toContain("non installare o eseguire codice");
  });

  it("builds a separate Wendy Brain prompt section", () => {
    const section = buildWendyBrainContextSection([
      {
        id: 1,
        type: "style_rule",
        title: "Do not over-explain",
        content: "Keep first answer compact.",
        status: "active",
        confidence: 0.9,
        importance: 0.7,
        metadata: {},
        sourceType: "admin_note",
        sourceRef: "note-1",
        score: 0.7,
      },
    ]);

    expect(section).toContain("## Wendy Brain");
    expect(section).toContain("[style_rule] Do not over-explain");
  });

  it("promotes candidates with approver metadata", async () => {
    await promoteWendyBrainCandidate(42, 7);

    expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
      status: "active",
      approvedBy: 7,
    }));
  });

  it("redacts common PII before global brain storage", () => {
    expect(sanitizeBrainText("Email test@example.com e telefono +39 333 123 4567")).toBe(
      "Email [redacted-email] e telefono [redacted-phone]",
    );
  });

  it("ingests tool registry affordances as candidate brain knowledge", async () => {
    const result = await runWendyBrainOptimizer();

    expect(result).toEqual({ recorded: 1 });
    expect(registryAllMock).toHaveBeenCalled();
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
      type: "tool_affordance",
      title: "Tool: get_salary_benchmark",
      sourceType: "tool_registry",
      sourceRef: "get_salary_benchmark",
      status: "candidate",
      metadata: expect.objectContaining({
        toolName: "get_salary_benchmark",
        domains: ["career"],
        intents: ["planning"],
        parameters: ["roleTitle", "geography"],
      }),
    }));
  });
});
