import { describe, expect, it, vi } from "vitest";
import { createKnowledgeSearchService } from "../knowledge-search.service";

describe("knowledge-search.service", () => {
  it("searches with normalized query and capped limit", async () => {
    const repo = { createNode: vi.fn(), search: vi.fn().mockResolvedValue([{ id: 1, userId: 1, title: "A", content: "B" }]), listNeighbors: vi.fn() };
    const result = await createKnowledgeSearchService(repo).search({ userId: 1, query: " graph ", limit: 100 });
    expect(repo.search).toHaveBeenCalledWith({ userId: 1, query: "graph", limit: 25 });
    expect(result).toHaveLength(1);
  });

  it("returns empty list for empty query", async () => {
    const repo = { createNode: vi.fn(), search: vi.fn(), listNeighbors: vi.fn() };
    await expect(createKnowledgeSearchService(repo).search({ userId: 1, query: " " })).resolves.toEqual([]);
  });

  it("propagates repository failures", async () => {
    const repo = { createNode: vi.fn(), search: vi.fn().mockRejectedValue(new Error("db down")), listNeighbors: vi.fn() };
    await expect(createKnowledgeSearchService(repo).search({ userId: 1, query: "x" })).rejects.toThrow("db down");
  });
});
