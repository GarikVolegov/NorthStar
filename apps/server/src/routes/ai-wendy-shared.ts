import { z } from "zod";
import type { LLMMessage } from "@workspace/ai-server";

export type AssistantToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type WendyToolMessage = LLMMessage & {
  tool_calls?: AssistantToolCall[];
};

export type WendyContextSource =
  | "app-data"
  | "rag"
  | "openhuman"
  | "graphify"
  | "wendy-brain"
  | "semantic-memory";

const APP_DATA_TOOLS = new Set([
  "get_sector_detail",
  "list_sectors",
  "get_profession_detail",
  "search_professions",
  "compare_sectors",
  "get_market_trend",
  "get_growth_articles",
  "get_news_summary",
  "get_learning_paths",
  "get_user_objectives",
  "get_user_context",
]);

export function buildWendyContextSources(input: {
  personalSources: Array<"openhuman" | "graphify" | "semantic-memory" | "wendy-brain" | "rag">;
  toolsUsed: string[];
  ragChunksRetrieved: number;
}): WendyContextSource[] {
  const sources = new Set<WendyContextSource>();
  for (const source of input.personalSources) sources.add(source);
  if (
    input.ragChunksRetrieved > 0 ||
    input.toolsUsed.includes("search_rag")
  ) {
    sources.add("rag");
  }
  if (input.toolsUsed.some((tool) => APP_DATA_TOOLS.has(tool))) {
    sources.add("app-data");
  }
  return [...sources];
}

export function isClientSideToolData(
  value: unknown,
): value is { clientSide: true } {
  return Boolean(
    value &&
      typeof value === "object" &&
      "clientSide" in value &&
      value.clientSide === true,
  );
}

export function isDoneWithLowEval(
  event: unknown,
): event is { type: "done"; evalResult: { level: "low" } } {
  return Boolean(
    event &&
      typeof event === "object" &&
      "type" in event &&
      event.type === "done" &&
      "evalResult" in event &&
      event.evalResult &&
      typeof event.evalResult === "object" &&
      "level" in event.evalResult &&
      event.evalResult.level === "low",
  );
}

const CompressedHistorySchema = z.object({
  summary: z.string().max(500).optional(),
  recentMessages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(12),
  totalTurns: z.number().int().min(0),
});

const WendyPageContextSchema = z.object({
  page: z.string().max(50),
  entityType: z.enum(["sector", "profession", "article", "news"]).optional(),
  entityId: z.number().int().positive().optional(),
  entityName: z.string().max(100).optional(),
  journeyType: z.string().max(30).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const WendyRequestSchema = z.object({
  message: z.string().min(1).max(5000),
  threadId: z.string().max(100).optional(),
  compressedHistory: CompressedHistorySchema.optional(),
  pageContext: WendyPageContextSchema.optional(),
  locale: z.string().max(5).default("it"),
  hasFileAttached: z.boolean().optional().default(false),
  isPredefined: z.boolean().optional().default(false),
  localHour: z.number().int().min(0).max(23).optional(),
  localDayOfWeek: z.number().int().min(0).max(6).optional(),
  focusMode: z.boolean().optional().default(false),
});
