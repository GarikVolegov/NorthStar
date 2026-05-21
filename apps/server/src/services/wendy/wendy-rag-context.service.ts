export interface WendyRagRetriever {
  retrieve(input: { userId: number; query: string; limit: number }): Promise<string[]>;
}

export function createWendyRagContextService(retriever: WendyRagRetriever) {
  return {
    async getContext(input: { userId: number; query: string; limit?: number }): Promise<string> {
      if (!input.query.trim()) return "";
      const limit = Math.min(Math.max(input.limit ?? 5, 1), 10);
      const chunks = await retriever.retrieve({
        userId: input.userId,
        query: input.query.trim(),
        limit,
      });
      return chunks.join("\n\n");
    },
  };
}
