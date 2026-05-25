import OpenAI from "openai";
import { logger } from "../../logger";
import type { AIPlugin, AIPluginHealth } from "../types";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import type { LLMMessage, LLMConfig, ChatWithToolsResult, ToolDefinitionOpenAI } from "../../llm/client";

const CLAUDE_OPUS_MODEL = process.env.MODEL_CLAUDE_OPUS ?? "anthropic/claude-opus-4-7";

export type ReasoningClaudeInput =
  | { mode: "chatOnce"; messages: LLMMessage[]; config?: LLMConfig }
  | { mode: "chatStream"; messages: LLMMessage[]; config?: LLMConfig }
  | { mode: "chatWithTools"; messages: LLMMessage[]; tools: ToolDefinitionOpenAI[]; config?: LLMConfig };

export type ReasoningClaudeOutput =
  | { mode: "chatOnce"; text: string }
  | { mode: "chatStream"; stream: AsyncIterable<string> }
  | { mode: "chatWithTools"; result: ChatWithToolsResult };

function pickClient(): { client: OpenAI; provider: "anthropic" | "openrouter" } | null {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      client: new OpenAI({
        apiKey: anthropicKey,
        baseURL: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com/v1",
      }),
      provider: "anthropic",
    };
  }
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return {
      client: new OpenAI({
        apiKey: openrouterKey,
        baseURL: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
      }),
      provider: "openrouter",
    };
  }
  return null;
}

function toOpenAIMessages(messages: LLMMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "tool") {
      return { role: "tool", content: m.content, tool_call_id: m.tool_call_id ?? "" };
    }
    return { role: m.role, content: m.content };
  }) as ChatCompletionMessageParam[];
}

export function isReasoningClaudeOpusAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY);
}

export const reasoningClaudeOpusPlugin: AIPlugin<ReasoningClaudeInput, ReasoningClaudeOutput> = {
  id: "reasoning-claude-opus",
  capability: "reasoning",
  version: "4.7.0",
  provider: process.env.ANTHROPIC_API_KEY ? "anthropic" : "openrouter",

  async init(): Promise<void> {
    if (!isReasoningClaudeOpusAvailable()) {
      throw new Error("Need ANTHROPIC_API_KEY or OPENROUTER_API_KEY for reasoning-claude-opus");
    }
  },

  async health(): Promise<AIPluginHealth> {
    const picked = pickClient();
    if (!picked) return { ok: false, message: "no API key configured" };
    return { ok: true, message: `provider=${picked.provider}` };
  },

  async execute(input: ReasoningClaudeInput): Promise<ReasoningClaudeOutput> {
    const picked = pickClient();
    if (!picked) throw new Error("reasoning-claude-opus: no API key configured");
    const { client } = picked;
    const model = input.config?.model ?? CLAUDE_OPUS_MODEL;
    const baseConfig = {
      model,
      temperature: input.config?.temperature ?? 0.2,
      max_tokens: input.config?.maxTokens ?? 1024,
    };

    if (input.mode === "chatOnce") {
      const completion = await client.chat.completions.create({
        ...baseConfig,
        messages: toOpenAIMessages(input.messages),
        stream: false,
      });
      return { mode: "chatOnce", text: completion.choices[0]?.message?.content ?? "" };
    }

    if (input.mode === "chatStream") {
      const stream = await client.chat.completions.create({
        ...baseConfig,
        messages: toOpenAIMessages(input.messages),
        stream: true,
      });
      async function* iterate(): AsyncIterable<string> {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) yield delta;
        }
      }
      return { mode: "chatStream", stream: iterate() };
    }

    const completion = await client.chat.completions.create({
      ...baseConfig,
      messages: toOpenAIMessages(input.messages),
      tools: input.tools as unknown as ChatCompletionTool[],
      stream: false,
    });
    const message = completion.choices[0]?.message;
    const finishReason = completion.choices[0]?.finish_reason;
    const toolCalls = (message?.tool_calls ?? [])
      .filter((tc): tc is Extract<typeof tc, { type: "function" }> => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tryParseJson(tc.function.arguments),
      }));
    return {
      mode: "chatWithTools",
      result: {
        content: message?.content ?? "",
        toolCalls,
        finishReason: finishReason === "tool_calls" ? "tool_calls" : finishReason === "length" ? "length" : "stop",
      },
    };
  },
};

function tryParseJson(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch (err) {
    logger.warn({ err, raw: raw.slice(0, 120) }, "[reasoning-claude-opus] tool args parse failed");
    return {};
  }
}
