import OpenAI from "openai";
import pRetry from "p-retry";
import { getOpenAIFallbackConfig } from "../client";
import { logger } from "../logger";
import { readToolCalls } from "./tool-call-parser";
import { CHAT_ONCE_TIMEOUT, CHAT_TIMEOUT, normalizeFinishReason, withTimeout } from "./shared";
import type { LLMProvider } from "./types";

export function createOpenAIProvider(): LLMProvider {
  const fallback = getOpenAIFallbackConfig();
  if (!fallback) {
    throw new Error("OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY must be set");
  }
  const client = new OpenAI({ apiKey: fallback.apiKey, baseURL: fallback.baseURL });
  const DEFAULT_MODEL = fallback.model;

  return {
    async chat(messages, config = {}) {
      const stream = await pRetry(
        () => withTimeout(
          (signal) => client.chat.completions.create({
            model: config.model ?? DEFAULT_MODEL,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            stream: true,
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }, { signal }),
          CHAT_TIMEOUT,
          "openai chat stream",
        ),
        {
          retries: 2,
          onFailedAttempt: (err) => {
            logger.warn({ err, attempt: err.attemptNumber }, "LLM chat retry");
          },
        },
      );

      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) yield delta;
          }
        },
      };
    },

    async chatOnce(messages, config = {}) {
      const res = await pRetry(
        () => withTimeout(
          (signal) => client.chat.completions.create({
            model: config.model ?? DEFAULT_MODEL,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            temperature: config.temperature ?? 0.7,
            max_tokens: config.maxTokens ?? 800,
          }, { signal }),
          CHAT_ONCE_TIMEOUT,
          "openai chatOnce",
        ),
        {
          retries: 2,
          onFailedAttempt: (err) => {
            logger.warn({ err, attempt: err.attemptNumber }, "LLM chatOnce retry");
          },
        },
      );
      return res.choices[0]?.message?.content ?? "";
    },

    async chatWithTools(messages, tools, config = {}) {
      const res = await pRetry(
        () => withTimeout(
          (signal) => client.chat.completions.create({
            model: config.model ?? DEFAULT_MODEL,
            messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
            tools:       tools as OpenAI.Chat.ChatCompletionTool[],
            tool_choice: "auto",
            temperature: config.temperature ?? 0.1,
            max_tokens:  config.maxTokens ?? 500,
          }, { signal }),
          CHAT_ONCE_TIMEOUT,
          "openai chatWithTools",
        ),
        { retries: 2, onFailedAttempt: (err) => logger.warn({ err, attempt: err.attemptNumber }, "LLM chatWithTools retry") },
      );
      const msg = res.choices[0]?.message;
      const toolCalls = readToolCalls(msg?.tool_calls);
      return {
        content:      msg?.content ?? "",
        toolCalls,
        finishReason: normalizeFinishReason(res.choices[0]?.finish_reason),
      };
    },
  };
}
