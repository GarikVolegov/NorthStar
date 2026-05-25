import type { KnowledgeNodeRecord, KnowledgeRepo } from "../../repos/knowledge/knowledge.repo";

export function createKnowledgeService(repo: KnowledgeRepo) {
  return {
    async createNode(input: { userId: number; title?: unknown; content?: unknown }): Promise<KnowledgeNodeRecord> {
      if (!Number.isInteger(input.userId) || input.userId <= 0) throw new Error("Invalid userId");
      const title = typeof input.title === "string" ? input.title.trim() : "";
      if (!title) throw new Error("Title is required");
      const content = typeof input.content === "string" ? input.content : "";
      return await repo.createNode({ userId: input.userId, title, content });
    },
  };
}
