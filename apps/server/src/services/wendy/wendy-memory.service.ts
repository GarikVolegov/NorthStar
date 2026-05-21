export interface WendyMemoryRepo {
  load(userId: number): Promise<string | null>;
  save(userId: number, value: string): Promise<void>;
}

export function createWendyMemoryService(repo: WendyMemoryRepo) {
  return {
    async loadMemory(userId: number): Promise<string> {
      if (!Number.isInteger(userId) || userId <= 0) throw new Error("Invalid userId");
      return (await repo.load(userId)) ?? "";
    },
    async saveMemory(userId: number, value: string): Promise<void> {
      if (!Number.isInteger(userId) || userId <= 0) throw new Error("Invalid userId");
      await repo.save(userId, value.trim());
    },
  };
}
