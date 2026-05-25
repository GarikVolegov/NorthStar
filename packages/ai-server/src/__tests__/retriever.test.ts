import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPoolQuery, mockDbSelect } = vi.hoisted(() => ({
  mockPoolQuery: vi.fn(),
  mockDbSelect: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn(() => Promise.resolve([])),
      })),
    })),
  })),
}));

vi.mock("@workspace/db", () => ({
  db: { select: mockDbSelect },
  pool: { query: mockPoolQuery },
  knowledgeNodesTable: {},
}));

vi.mock("../growth-agent/embedder", () => ({
  embedText: vi.fn(async (text: string) => {
    const fake: number[] = new Array<number>(1536).fill(0);
    const hash = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    fake[0] = hash / 1000;
    fake[1] = 0.5;
    return fake;
  }),
  EMBEDDING_DIMS: 1536,
}));

import {
  cosine,
  retrieve,
  retrieverWithTimeout,
  validateQueryEmbedding,
} from "../growth-agent/retriever";
import { embedText } from "../growth-agent/embedder";

describe("Retriever", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  describe("cosine", () => {
    it("scores identical vectors close to 1", () => {
      expect(cosine([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
    });

    it("does not return NaN for zero vectors", () => {
      expect(Number.isFinite(cosine([0, 0], [0, 0]))).toBe(true);
    });
  });

  describe("validation", () => {
    it("rejects non-finite embedding values", () => {
      expect(() => validateQueryEmbedding([1, Number.NaN], 2)).toThrow(/non-finite/);
      expect(() => validateQueryEmbedding([1, Number.POSITIVE_INFINITY], 2)).toThrow(/non-finite/);
    });

    it("rejects wrong embedding dimensions", () => {
      expect(() => validateQueryEmbedding([1, 2, 3], 2)).toThrow(/expected 2 dims/);
    });

    it("does not query pgvector when the query embedding is invalid", async () => {
      const invalid: number[] = new Array<number>(1536).fill(0);
      invalid[10] = Number.NaN;
      vi.mocked(embedText).mockResolvedValueOnce(invalid);

      await expect(retrieve("bad embedding", 1)).rejects.toThrow(/non-finite/);
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });
  });

  describe("timeout", () => {
    it("rejects when the operation is too slow", async () => {
      await expect(
        retrieverWithTimeout(new Promise((resolve) => setTimeout(resolve, 25)), 1),
      ).rejects.toThrow(/timeout/);
    });
  });

  describe("embedding", () => {
    it("calls embedText with the query", async () => {
      const spy = vi.mocked(embedText);
      await retrieve("test query", 1, { topK: 3, minScore: 0.30 });
      expect(spy).toHaveBeenCalledWith("test query");
    });
  });

  describe("scoring and filtering", () => {
    it("returns empty array when no results meet minScore", async () => {
      const result = await retrieve("unrelated text", 1, { topK: 5, minScore: 0.95 });
      expect(result).toHaveLength(0);
    });

    it("respects topK limit", async () => {
      const result = await retrieve("test", 1, { topK: 2, minScore: 0.0 });
      expect(result.length).toBeLessThanOrEqual(2);
    });

    it("returns sorted results by score descending", async () => {
      const query = "similar text";
      const result = await retrieve(query, 1, { topK: 5, minScore: 0.0 });
      for (let i = 1; i < result.length; i++) {
        const current = result[i];
        const previous = result[i - 1];
        expect(current?.score).toBeLessThanOrEqual(previous?.score ?? 0);
      }
    });

    it("filters by sourceTypes", async () => {
      const result = await retrieve("test", 1, {
        topK: 5,
        minScore: 0.0,
        sourceTypes: ["document"],
      });
      for (const r of result) {
        expect(r.sourceType).toBe("document");
      }
    });
  });

  describe("pgvector mode", () => {
    it("queries pgvector as default", async () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });
      const result = await retrieve("test", 1, { topK: 3, minScore: 0.30 });
      expect(mockPoolQuery).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("includes platform_content userId filter when source includes platform_content", async () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });
      await retrieve("test", 1, {
        topK: 3,
        minScore: 0.30,
        sourceTypes: ["platform_content", "document"],
      });
      const sqlText = String(mockPoolQuery.mock.calls[0]?.[0] ?? "");
      expect(sqlText).toContain("user_id = $2 OR user_id = $5");
    });

    it("does not include platform_content filter when sourceTypes excludes it", async () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });
      await retrieve("test", 1, {
        topK: 3,
        minScore: 0.30,
        sourceTypes: ["document"],
      });
      const sqlText = String(mockPoolQuery.mock.calls[0]?.[0] ?? "");
      expect(sqlText).not.toContain("user_id = $2 OR user_id = $5");
    });

    it("falls back to JS retriever when pgvector fails", async () => {
      mockPoolQuery.mockRejectedValue(new Error("pgvector not available"));
      const result = await retrieve("test", 1, { topK: 3, minScore: 0.0 });
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
