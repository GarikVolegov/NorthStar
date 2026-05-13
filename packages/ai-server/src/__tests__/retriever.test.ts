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
    const fake = new Array(1536).fill(0);
    const hash = text.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    fake[0] = hash / 1000;
    fake[1] = 0.5;
    return fake;
  }),
  EMBEDDING_DIMS: 1536,
}));

import { retrieve, type RetrievedChunk, type SourceType } from "../growth-agent/retriever";
import { embedText } from "../growth-agent/embedder";

function makeChunk(text: string, score: number): RetrievedChunk {
  return { id: 1, content: text, source: "test", sourceType: "document", score, metadata: {} };
}

describe("Retriever", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PGVECTOR = "false";
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
        expect(result[i].score).toBeLessThanOrEqual(result[i - 1].score);
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
    beforeEach(() => {
      process.env.PGVECTOR = "true";
    });

    it("queries pgvector when PGVECTOR=true", async () => {
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
      // Should include userId=0 in query params
      const sqlText = mockPoolQuery.mock.calls[0][0] as string;
      expect(sqlText).toContain("user_id = $2 OR user_id = $5");
    });

    it("does not include platform_content filter when sourceTypes excludes it", async () => {
      mockPoolQuery.mockResolvedValue({ rows: [] });
      await retrieve("test", 1, {
        topK: 3,
        minScore: 0.30,
        sourceTypes: ["document"],
      });
      const sqlText = mockPoolQuery.mock.calls[0][0] as string;
      expect(sqlText).not.toContain("user_id = $2 OR user_id = $5");
    });
  });
});
