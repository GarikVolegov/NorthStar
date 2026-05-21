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
  localHour: z.number().int().min(0).max(23).optional(),
  localDayOfWeek: z.number().int().min(0).max(6).optional(),
  focusMode: z.boolean().optional().default(false),
});
