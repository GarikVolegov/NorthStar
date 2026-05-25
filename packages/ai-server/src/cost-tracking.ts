/**
 * cost-tracking.ts — LLM cost estimation and database logging
 *
 * Pricing sources (as of 2026-05):
 *   OpenAI:   https://openai.com/api/pricing/
 *   Groq:     https://groq.com/pricing/
 *
 * Each model's cost per 1K tokens (input / output) in USD.
 * Falls back to rough estimate if model is unknown.
 */

import { logger } from "./logger";
import { db, llmUsageTable } from "@workspace/db";

export interface ModelPricing {
  inputPer1K: number;
  outputPer1K: number;
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI
  "gpt-4o":              { inputPer1K: 0.0025, outputPer1K: 0.01 },
  "gpt-4o-mini":         { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  "gpt-4o-audio-preview":{ inputPer1K: 0.0025, outputPer1K: 0.01 },
  "o1":                  { inputPer1K: 0.015, outputPer1K: 0.06 },
  "o1-mini":             { inputPer1K: 0.003, outputPer1K: 0.012 },
  "o3-mini":             { inputPer1K: 0.0011, outputPer1K: 0.0044 },

  // Groq (very cheap, free tier covers most dev usage)
  "llama-3.3-70b-versatile":     { inputPer1K: 0.00059, outputPer1K: 0.00079 },
  "llama-3.1-8b-instant":        { inputPer1K: 0.00004, outputPer1K: 0.00004 },
  "llama-3.1-70b-versatile":     { inputPer1K: 0.00059, outputPer1K: 0.00079 },
  "mixtral-8x7b-32768":          { inputPer1K: 0.00024, outputPer1K: 0.00024 },

  // OpenRouter free tier — actual cost is 0 (rate-limited)
  "deepseek/deepseek-chat-v3-0324:free":          { inputPer1K: 0, outputPer1K: 0 },
  "deepseek/deepseek-r1:free":                    { inputPer1K: 0, outputPer1K: 0 },
  "meta-llama/llama-3.3-70b-instruct:free":       { inputPer1K: 0, outputPer1K: 0 },
  "qwen/qwen-2.5-72b-instruct:free":              { inputPer1K: 0, outputPer1K: 0 },
  "google/gemini-2.0-flash-exp:free":             { inputPer1K: 0, outputPer1K: 0 },

  // OpenRouter paid (fallback if free tier rate-limited)
  "deepseek/deepseek-chat-v3-0324":               { inputPer1K: 0.00028, outputPer1K: 0.00088 },
  "deepseek/deepseek-r1":                         { inputPer1K: 0.00055, outputPer1K: 0.00219 },
  "anthropic/claude-3.5-haiku":                   { inputPer1K: 0.0008, outputPer1K: 0.004 },
};

export const DEFAULT_PRICING: ModelPricing = { inputPer1K: 0.002, outputPer1K: 0.008 };

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputCost = (promptTokens / 1000) * pricing.inputPer1K;
  const outputCost = (completionTokens / 1000) * pricing.outputPer1K;
  return inputCost + outputCost;
}

export function getProvider(model: string): string {
  if (model.includes("/")) return "openrouter"; // e.g. "deepseek/deepseek-chat-v3:free"
  if (model.startsWith("llama") || model.startsWith("mixtral")) return "groq";
  if (model.startsWith("gpt") || model.startsWith("o1") || model.startsWith("o3") || model.startsWith("dall")) return "openai";
  return "unknown";
}

export async function recordLlmUsage(opts: {
  userId: number;
  model: string;
  promptTokens: number;
  completionTokens: number;
  requestType: string;
  endpoint?: string;
  metadata?: string;
}): Promise<void> {
  const totalTokens = opts.promptTokens + opts.completionTokens;
  const estimatedCostUsd = estimateCost(opts.model, opts.promptTokens, opts.completionTokens);

  try {
    await db.insert(llmUsageTable).values({
      userId: opts.userId,
      model: opts.model,
      provider: getProvider(opts.model),
      promptTokens: opts.promptTokens,
      completionTokens: opts.completionTokens,
      totalTokens,
      estimatedCostUsd,
      requestType: opts.requestType,
      endpoint: opts.endpoint ?? null,
      metadata: opts.metadata ?? null,
    });
  } catch (err) {
    logger.error({ err }, "[cost-tracking] Failed to record LLM usage");
  }
}
