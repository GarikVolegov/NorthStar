import type { AdminSystemRepo } from "../../repos/admin/system.repo";

export function createErrorReportingService(repo: AdminSystemRepo) {
  return {
    async listRecentErrors(input: { limit?: unknown } = {}) {
      const rawLimit = Number(input.limit ?? 20);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 100)
        : 20;
      return { errors: await repo.listErrors(limit) };
    },
  };
}
