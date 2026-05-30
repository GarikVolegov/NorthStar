import type OpenAI from "openai";
import type { WendyIntent } from "../wendy-router/types";
import type { Domain } from "../growth-agent/router-agent";
import type { z } from "zod/v4";

export interface PluginParam {
  name:        string;
  type:        "string" | "number" | "boolean" | "array";
  description: string;
  required?:   boolean;
  /** For `type: "array"`, the JSON-schema type of the items (default "string"). */
  itemType?:   "string" | "number" | "integer" | "boolean";
}

export interface PluginToolContext {
  userId:    number;
  requestId: string;
}

export interface ToolDefinition<
  TInput = Record<string, unknown>,
  TOutput = unknown,
> {
  name: string;
  description: string;
  inputSchema: z.ZodSchema<TInput>;
  outputSchema: z.ZodSchema<TOutput>;
  domains: Domain[];
  intents: WendyIntent[];
  isUiTool: boolean;
  requiresWrite: boolean;
  rateLimit?: { maxPerHour: number };
  handler: (input: TInput, ctx: PluginToolContext) => Promise<TOutput>;
}

export interface PluginToolDefinition<
  TInput  = Record<string, unknown>,
  TOutput = unknown,
> {
  name:          string;
  description:   string;
  parameters?:   PluginParam[];
  inputSchema?:  z.ZodSchema<TInput>;
  outputSchema?: z.ZodSchema<TOutput>;
  domains?:      Domain[];
  intents:       WendyIntent[];
  isUiTool:      boolean;
  requiresWrite: boolean;
  rateLimit?:    { maxPerHour: number };
  handler?:      (input: TInput, ctx: PluginToolContext) => Promise<TOutput>;
}

export type { WendyIntent };
export type { Domain };

export function toOpenAITool(t: PluginToolDefinition): OpenAI.Chat.ChatCompletionTool {
  const parameters = t.parameters ?? [];
  return {
    type: "function",
    function: {
      name:        t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          parameters.map((p) => [
            p.name,
            {
              type:        p.type === "array" ? "array" : p.type,
              description: p.description,
              ...(p.type === "array" ? { items: { type: "integer" } } : {}),
            },
          ]),
        ),
        required: parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  };
}
