import { getLLM, type LLMMessage, type LLMConfig, type ChatWithToolsResult, type ToolDefinitionOpenAI } from "../../llm/client";
import type { AIPlugin, AIPluginHealth } from "../types";

export type ReasoningPluginInput =
  | { mode: "chatOnce"; messages: LLMMessage[]; config?: LLMConfig }
  | { mode: "chatStream"; messages: LLMMessage[]; config?: LLMConfig }
  | { mode: "chatWithTools"; messages: LLMMessage[]; tools: ToolDefinitionOpenAI[]; config?: LLMConfig };

export type ReasoningPluginOutput =
  | { mode: "chatOnce"; text: string }
  | { mode: "chatStream"; stream: AsyncIterable<string> }
  | { mode: "chatWithTools"; result: ChatWithToolsResult };

function getProviderName(): string {
  const explicit = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (explicit === "openrouter" || explicit === "groq") return explicit;
  return "openai";
}

export const reasoningDefaultPlugin: AIPlugin<ReasoningPluginInput, ReasoningPluginOutput> = {
  id: "reasoning-default",
  capability: "reasoning",
  version: "1.0.0",
  provider: getProviderName(),

  async init(): Promise<void> {
    getLLM();
  },

  async health(): Promise<AIPluginHealth> {
    const t0 = Date.now();
    try {
      const llm = getLLM();
      const text = await llm.chatOnce(
        [{ role: "user", content: "ping" }],
        { maxTokens: 5, temperature: 0 },
      );
      return { ok: text.length >= 0, latencyMs: Date.now() - t0 };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  },

  async execute(input: ReasoningPluginInput): Promise<ReasoningPluginOutput> {
    const llm = getLLM();
    switch (input.mode) {
      case "chatOnce": {
        const text = await llm.chatOnce(input.messages, input.config);
        return { mode: "chatOnce", text };
      }
      case "chatStream": {
        const stream = await llm.chat(input.messages, input.config);
        return { mode: "chatStream", stream };
      }
      case "chatWithTools": {
        const result = await llm.chatWithTools(input.messages, input.tools, input.config);
        return { mode: "chatWithTools", result };
      }
    }
  },
};
