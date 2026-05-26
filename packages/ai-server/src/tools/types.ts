import type OpenAI from "openai";
import type { WendyIntent } from "../wendy-router/types";

export interface PluginParam {
  name:        string;
  type:        "string" | "number" | "boolean" | "array";
  description: string;
  required?:   boolean;
}

export interface PluginToolContext {
  userId:    number;
  requestId: string;
}

export interface PluginToolDefinition<
  TInput  = Record<string, unknown>,
  TOutput = unknown,
> {
  name:          string;
  description:   string;
  parameters:    PluginParam[];
  intents:       WendyIntent[];
  isUiTool:      boolean;
  requiresWrite: boolean;
  rateLimit?:    { maxPerHour: number };
  handler?:      (input: TInput, ctx: PluginToolContext) => Promise<TOutput>;
}

export type { WendyIntent };

export function toOpenAITool(t: PluginToolDefinition): OpenAI.Chat.ChatCompletionTool {
  return {
    type: "function",
    function: {
      name:        t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          t.parameters.map((p) => [
            p.name,
            {
              type:        p.type === "array" ? "array" : p.type,
              description: p.description,
              ...(p.type === "array" ? { items: { type: "integer" } } : {}),
            },
          ]),
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  };
}
