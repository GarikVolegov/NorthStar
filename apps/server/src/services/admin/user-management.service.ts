import type { AdminUserRepo, AdminUserSummary } from "../../repos/admin/user.repo";

export interface ListUsersInput {
  search?: unknown;
  limit?: unknown;
}

export function createUserManagementService(repo: AdminUserRepo) {
  return {
    async listUsers(input: ListUsersInput = {}): Promise<{ users: AdminUserSummary[] }> {
      const search = typeof input.search === "string" && input.search.trim()
        ? input.search.trim()
        : undefined;
      const rawLimit = Number(input.limit ?? 50);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 100)
        : 50;

      return { users: await repo.listUsers({ ...(search ? { search } : {}), limit }) };
    },
  };
}
