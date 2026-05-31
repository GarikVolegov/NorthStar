import { beforeEach, describe, expect, it, vi } from "vitest";

const executeMock = vi.hoisted(() => vi.fn());
const embeddingMock = vi.hoisted(() => vi.fn());

vi.mock("@workspace/db", () => ({
  db: {
    execute: executeMock,
  },
}));

vi.mock("../embeddings/generate", () => ({
  generateEmbedding: embeddingMock,
}));

vi.mock("../logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

import {
  handleSearchBrain,
  searchBrainSqlParts,
} from "../wendy-router/tool-handlers-market";

describe("search_brain Wendy tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    embeddingMock.mockResolvedValue([0.1, 0.2, 0.3]);
    executeMock.mockResolvedValue({
      rows: [
        {
          content: "RAG Pipeline grounds Wendy on curated NorthStar knowledge.",
          obsidian_path: ".brain/20_Product/Subsystems/RAG-Pipeline.md",
          sectors: ["product"],
          roles: ["product", "rag"],
          similarity: 0.91,
          trust_score: 0.95,
        },
      ],
    });
  });

  it("filters on the raw frontmatter layer word that vault-ingest stores", () => {
    // vault-ingest writes rc.sectors = [layer] using the raw word, so the
    // filter tag must be the raw layer — not an L1/L2/L3 code.
    expect(searchBrainSqlParts({ layer: "product" })).toEqual({
      sourceType: "brain",
      layerTag: "product",
    });
    expect(searchBrainSqlParts({})).toEqual({
      sourceType: "brain",
      layerTag: null,
    });
  });

  it("returns brain chunks with obsidian paths and layer metadata", async () => {
    const result = await handleSearchBrain({
      query: "spiegami la pipeline RAG",
      layer: "product",
      limit: 3,
    });

    expect(result).toEqual({
      ok: true,
      data: {
        chunks: [
          {
            content: "RAG Pipeline grounds Wendy on curated NorthStar knowledge.",
            obsidianPath: ".brain/20_Product/Subsystems/RAG-Pipeline.md",
            sectors: ["product"],
            roles: ["product", "rag"],
            similarity: 0.91,
            trustScore: 0.95,
          },
        ],
        totalFound: 1,
      },
    });
    expect(executeMock).toHaveBeenCalledTimes(1);
  });

  it("rejects empty queries before embedding", async () => {
    await expect(handleSearchBrain({ query: "   " })).resolves.toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(embeddingMock).not.toHaveBeenCalled();
    expect(executeMock).not.toHaveBeenCalled();
  });
});
