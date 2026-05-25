import { aiPlugins } from "@workspace/ai-server";

export interface SemanticMemoryBridgeResult {
  id: string;
  content: string;
  score?: number;
  updatedAt?: string;
  source: string;
}

export interface SemanticMemoryRecall {
  available: boolean;
  source: "semantic-memory";
  memories: SemanticMemoryBridgeResult[];
  reason?: string;
}

interface MemoryPluginRecallOutput {
  op: "recall";
  memories: SemanticMemoryBridgeResult[];
}

function isEnabled(): boolean {
  return process.env.FF_SEMANTIC_MEMORY === "true" || process.env.FF_SEMANTIC_MEMORY === "1";
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function isRecallOutput(value: unknown): value is MemoryPluginRecallOutput {
  const record = readRecord(value);
  return Boolean(record && record.op === "recall" && Array.isArray(record.memories));
}

function clampLimit(limit: number): number {
  return Math.max(1, Math.min(12, Math.floor(limit)));
}

export async function recallSemanticMemory(
  query: string,
  userId: number,
  limit = 5,
): Promise<SemanticMemoryRecall> {
  if (!isEnabled()) {
    return { available: false, source: "semantic-memory", memories: [], reason: "disabled" };
  }
  const plugin = aiPlugins.getBest("memory");
  if (!plugin) {
    return { available: false, source: "semantic-memory", memories: [], reason: "no_plugin" };
  }
  const output = await plugin.execute({
    op: "recall",
    userId,
    query,
    limit: clampLimit(limit),
  });
  if (!isRecallOutput(output)) {
    return { available: false, source: "semantic-memory", memories: [], reason: "invalid_plugin_output" };
  }
  return {
    available: true,
    source: "semantic-memory",
    memories: output.memories.slice(0, clampLimit(limit)),
  };
}

export async function buildSemanticMemoryContext(
  query: string,
  userId: number,
): Promise<string> {
  const recall = await recallSemanticMemory(query, userId, 5);
  if (!recall.available || recall.memories.length === 0) return "";
  const lines = recall.memories.map((memory, index) => {
    const score = typeof memory.score === "number" ? ` score=${memory.score.toFixed(2)}` : "";
    return `${index + 1}. ${memory.content}${score}`;
  });
  return `\n\n## Memoria semantica Wendy\n${lines.join("\n")}`;
}

export function storeSemanticTurnInBackground(input: {
  userId: number;
  userMessage: string;
  assistantResponse: string;
}): void {
  if (!isEnabled()) return;
  const plugin = aiPlugins.getBest("memory");
  if (!plugin) return;
  const userContent = input.userMessage.trim();
  const assistantContent = input.assistantResponse.trim();
  if (!userContent || !assistantContent) return;
  void plugin.execute({
    op: "store",
    userId: input.userId,
    turns: [
      { role: "user", content: userContent },
      { role: "assistant", content: assistantContent },
    ],
  }).catch(() => {
    // Semantic memory is optional: never block Wendy response delivery.
  });
}
