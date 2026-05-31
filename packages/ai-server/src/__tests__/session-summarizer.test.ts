import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDbSelect = vi.hoisted(() => vi.fn());
const mockDbInsert = vi.hoisted(() => vi.fn());
const mockDbUpdate = vi.hoisted(() => vi.fn());
const mockChatCreate = vi.hoisted(() => vi.fn());
const mockIsLlmConfigured = vi.hoisted(() => vi.fn(() => true));

vi.mock("@workspace/db", () => ({
  db: { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate },
  sessionSummariesTable: {
    id: "id",
    userId: "user_id",
    sessionId: "session_id",
    summary: "summary",
    keyThemes: "key_themes",
    mood: "mood",
    createdAt: "created_at",
    deletedAt: "deleted_at",
  },
}));

vi.mock("../client", () => ({
  openai: { chat: { completions: { create: mockChatCreate } } },
  isLlmConfigured: mockIsLlmConfigured,
}));

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("../model-router", () => ({
  selectModelFor: () => ({ model: "test-micro", provider: "openai", reason: "micro" }),
}));

import {
  summarizeSession,
  buildSessionHistorySection,
} from "../growth-agent/session-summarizer";

// Drizzle chain helpers -------------------------------------------------------
function selectChain(rows: unknown[]) {
  return {
    from: () => ({
      where: () => ({
        // loadRecentSummaries path (orderBy → limit)
        orderBy: () => ({ limit: () => Promise.resolve(rows) }),
        // summarizeSession existing-row lookup (direct limit)
        limit: () => Promise.resolve(rows),
      }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsLlmConfigured.mockReturnValue(true);
  mockChatCreate.mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            summary: "L'utente vuole cambiare carriera verso il design.",
            keyThemes: ["cambio carriera", "design"],
            mood: "positive",
          }),
        },
      },
    ],
  });
  mockDbInsert.mockReturnValue({ values: () => Promise.resolve(undefined) });
  mockDbUpdate.mockReturnValue({ set: () => ({ where: () => Promise.resolve(undefined) }) });
});

describe("summarizeSession", () => {
  it("inserts a new summary when none exists for the session", async () => {
    mockDbSelect.mockReturnValue(selectChain([])); // no existing row
    await summarizeSession(1, 42, [
      { role: "user", content: "Voglio cambiare lavoro" },
      { role: "assistant", content: "Parliamone" },
    ]);
    expect(mockChatCreate).toHaveBeenCalledOnce();
    expect(mockDbInsert).toHaveBeenCalledOnce();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });

  it("updates the existing summary instead of inserting a duplicate", async () => {
    mockDbSelect.mockReturnValue(selectChain([{ id: 7 }])); // existing row
    await summarizeSession(1, 42, [
      { role: "user", content: "Aggiornamento" },
      { role: "assistant", content: "Ok" },
    ]);
    expect(mockDbUpdate).toHaveBeenCalledOnce();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("no-ops (no LLM call) when no provider is configured", async () => {
    mockIsLlmConfigured.mockReturnValue(false);
    await summarizeSession(1, 42, [{ role: "user", content: "ciao" }]);
    expect(mockChatCreate).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("skips save when the model returns an empty summary", async () => {
    mockDbSelect.mockReturnValue(selectChain([]));
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ keyThemes: [] }) } }],
    });
    await summarizeSession(1, 42, [{ role: "user", content: "x" }]);
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("does nothing for an empty transcript", async () => {
    await summarizeSession(1, 42, []);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });
});

describe("buildSessionHistorySection", () => {
  it("returns empty string with no summaries", () => {
    expect(buildSessionHistorySection([])).toBe("");
  });

  it("formats summaries into a prompt section", () => {
    const out = buildSessionHistorySection([
      { summary: "Sintesi A", keyThemes: ["a", "b"], mood: "positive" },
    ]);
    expect(out).toContain("## Contesto sessioni recenti");
    expect(out).toContain("Sintesi A");
    expect(out).toContain("Temi: a, b");
    expect(out).toContain("Tono: positive");
  });
});
