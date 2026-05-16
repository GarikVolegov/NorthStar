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
  "gpt-4o":              { inputPer1K: 0.0025, outputPer1K: 0.01 },
  "gpt-4o-mini":         { inputPer1K: 0.00015, outputPer1K: 0.0006 },
  "gpt-4o-audio-preview":{ inputPer1K: 0.0025, outputPer1K: 0.01 },
  "o1":                  { inputPer1K: 0.015, outputPer1K: 0.06 },
  "o1-mini":             { inputPer1K: 0.003, outputPer1K: 0.012 },
  "o3-mini":             { inputPer1K: 0.0011, outputPer1K: 0.0044 },
  "llama-3.3-70b-versatile": { inputPer1K: 0.00059, outputPer1K: 0.00079 },
  "llama-3.1-8b-instant":    { inputPer1K: 0.00004, outputPer1K: 0.00004 },
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
  if (model.startsWith("gpt") || model.startsWith("o")) return "openai";
  if (model.startsWith("llama") || model.startsWith("mixtral")) return "groq";
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
