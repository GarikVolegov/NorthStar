import { describe, expect, it, vi } from "vitest";
import { createUserManagementService } from "../user-management.service";

describe("user-management.service", () => {
  it("normalizes list input", async () => {
    const repo = { listUsers: vi.fn().mockResolvedValue([{ id: 1, email: "a@b.test", name: "A", role: "user" }]) };
    const result = await createUserManagementService(repo).listUsers({ search: " ada ", limit: "500" });
    expect(repo.listUsers).toHaveBeenCalledWith({ search: "ada", limit: 100 });
    expect(result.users).toHaveLength(1);
  });

  it("uses defaults for invalid input", async () => {
    const repo = { listUsers: vi.fn().mockResolvedValue([]) };
    await createUserManagementService(repo).listUsers({ limit: -1 });
    expect(repo.listUsers).toHaveBeenCalledWith({ limit: 50 });
  });

  it("propagates repository failures", async () => {
    const repo = { listUsers: vi.fn().mockRejectedValue(new Error("db down")) };
    await expect(createUserManagementService(repo).listUsers()).rejects.toThrow("db down");
  });
});
