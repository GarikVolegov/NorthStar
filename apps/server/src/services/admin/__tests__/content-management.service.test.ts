import { describe, expect, it, vi } from "vitest";
import { createContentManagementService } from "../content-management.service";

describe("content-management.service", () => {
  it("passes valid status filters", async () => {
    const repo = { listContent: vi.fn().mockResolvedValue([{ id: 1, title: "T", status: "draft", updatedAt: new Date() }]) };
    await createContentManagementService(repo).listContent({ status: "draft", limit: 5 });
    expect(repo.listContent).toHaveBeenCalledWith({ status: "draft", limit: 5 });
  });

  it("drops invalid status filters", async () => {
    const repo = { listContent: vi.fn().mockResolvedValue([]) };
    await createContentManagementService(repo).listContent({ status: "bad" });
    expect(repo.listContent).toHaveBeenCalledWith({ limit: 50 });
  });

  it("propagates repository failures", async () => {
    const repo = { listContent: vi.fn().mockRejectedValue(new Error("db down")) };
    await expect(createContentManagementService(repo).listContent()).rejects.toThrow("db down");
  });
});
