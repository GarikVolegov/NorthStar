import type { KnowledgeNodeRecord, KnowledgeRepo } from "../../repos/knowledge/knowledge.repo";

export function createKnowledgeGraphService(repo: KnowledgeRepo) {
  return {
    async listNeighbors(input: { userId: number; nodeId: number }): Promise<KnowledgeNodeRecord[]> {
      if (!Number.isInteger(input.nodeId) || input.nodeId <= 0) {
        throw new Error("Invalid nodeId");
      }
      return await repo.listNeighbors(input);
    },
  };
}
