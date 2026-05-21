export interface KnowledgeNodeRecord {
  id: number;
  userId: number;
  title: string;
  content: string;
}

export interface KnowledgeRepo {
  createNode(input: Omit<KnowledgeNodeRecord, "id">): Promise<KnowledgeNodeRecord>;
  search(input: { userId: number; query: string; limit: number }): Promise<KnowledgeNodeRecord[]>;
  listNeighbors(input: { userId: number; nodeId: number }): Promise<KnowledgeNodeRecord[]>;
}
