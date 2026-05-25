import type { AdminContentRepo, AdminContentSummary } from "../../repos/admin/content.repo";

const CONTENT_STATUSES = ["draft", "published", "archived"] as const;
type ContentStatus = (typeof CONTENT_STATUSES)[number];

function isContentStatus(value: unknown): value is ContentStatus {
  return typeof value === "string" && CONTENT_STATUSES.includes(value as ContentStatus);
}

export function createContentManagementService(repo: AdminContentRepo) {
  return {
    async listContent(input: { status?: unknown; limit?: unknown } = {}): Promise<{
      items: AdminContentSummary[];
    }> {
      const status = isContentStatus(input.status) ? input.status : undefined;
      const rawLimit = Number(input.limit ?? 50);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 100)
        : 50;

      return { items: await repo.listContent({ ...(status ? { status } : {}), limit }) };
    },
  };
}
