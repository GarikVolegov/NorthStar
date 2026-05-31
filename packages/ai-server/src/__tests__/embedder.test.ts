import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock("openai", () => ({
  OpenAI: vi.fn(() => ({
    embeddings: {
      create: mockCreate,
    },
  })),
}));

import { chunkText, embedBatch, embedText } from "../growth-agent/embedder";

describe("embedder", () => {
  beforeEach(() => {
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY = "sk-test";
    delete process.env.OPENROUTER_API_KEY;
    mockCreate.mockReset();
  });

  it("chunks text with overlap", () => {
    const chunks = chunkText("one two three four five", 3, 1);
    expect(chunks).toEqual(["one two three", "three four five", "five"]);
  });

  it("embeds a single text and truncates provider input", async () => {
    mockCreate.mockResolvedValueOnce({ data: [{ embedding: [0.1, 0.2] }] });
    const embedding = await embedText("x".repeat(9_000));
    expect(embedding).toEqual([0.1, 0.2]);
    const request = mockCreate.mock.calls[0]?.[0] as
      | { input?: unknown }
      | undefined;
    expect(request?.input).toHaveLength(8_000);
  });

  it("throws when the provider returns no embedding data", async () => {
    mockCreate.mockResolvedValueOnce({ data: [] });
    await expect(embedText("hello")).rejects.toThrow(/no data/);
  });

  it("embeds batches", async () => {
    mockCreate.mockResolvedValueOnce({
      data: [{ embedding: [1] }, { embedding: [2] }],
    });
    await expect(embedBatch(["a", "b"])).resolves.toEqual([[1], [2]]);
  });
});
