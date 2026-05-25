import { describe, expect, it, vi } from "vitest";
import { createKnowledgeService } from "../knowledge.service";

describe("knowledge.service", () => {
  it("creates a normalized node", async () => {
    const repo = { createNode: vi.fn().mockResolvedValue({ id: 1, userId: 1, title: "Node", content: "" }), search: vi.fn(), listNeighbors: vi.fn() };
    const result = await createKnowledgeService(repo).createNode({ userId: 1, title: " Node " });
    expect(repo.createNode).toHaveBeenCalledWith({ userId: 1, title: "Node", content: "" });
    expect(result.id).toBe(1);
  });

  it("rejects invalid titles", async () => {
    const repo = { createNode: vi.fn(), search: vi.fn(), listNeighbors: vi.fn() };
    await expect(createKnowledgeService(repo).createNode({ userId: 1, title: "" })).rejects.toThrow("Title is required");
  });

  it("propagates repository failures", async () => {
    const repo = { createNode: vi.fn().mockRejectedValue(new Error("db down")), search: vi.fn(), listNeighbors: vi.fn() };
    await expect(createKnowledgeService(repo).createNode({ userId: 1, title: "Node" })).rejects.toThrow("db down");
  });
});
