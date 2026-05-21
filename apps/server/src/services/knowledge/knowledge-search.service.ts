import type { KnowledgeNodeRecord, KnowledgeRepo } from "../../repos/knowledge/knowledge.repo";

export function createKnowledgeSearchService(repo: KnowledgeRepo) {
  return {
    async search(input: { userId: number; query?: unknown; limit?: unknown }): Promise<KnowledgeNodeRecord[]> {
      const query = typeof input.query === "string" ? input.query.trim() : "";
      if (!query) return [];
      const rawLimit = Number(input.limit ?? 10);
      const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 25) : 10;
      return await repo.search({ userId: input.userId, query, limit });
    },
  };
}
