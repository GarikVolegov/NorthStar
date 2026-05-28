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
  brainLayerToSector,
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
          sectors: ["L3"],
          roles: ["L3", "product", "rag"],
          similarity: 0.91,
          trust_score: 0.95,
        },
      ],
    });
  });

  it("maps brain layers to stored sector tags", () => {
    expect(brainLayerToSector("identity")).toBe("L1");
    expect(brainLayerToSector("domain")).toBe("L2");
    expect(brainLayerToSector("product")).toBe("L3");
    expect(brainLayerToSector("process")).toBe("L3.5");
  });

  it("builds immutable brain-only SQL parts", () => {
    expect(searchBrainSqlParts({ layer: "product" })).toEqual({
      sourceType: "brain",
      layerSector: "L3",
    });
    expect(searchBrainSqlParts({})).toEqual({
      sourceType: "brain",
      layerSector: null,
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
            sectors: ["L3"],
            roles: ["L3", "product", "rag"],
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
