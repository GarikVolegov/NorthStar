import { generateEmbedding, generateEmbeddingsBatch } from "../../embeddings/generate";
import type { AIPlugin, AIPluginHealth } from "../types";

export type EmbeddingPluginInput =
  | { mode: "single"; text: string }
  | { mode: "batch"; items: Array<{ id: string | number; text: string }> };

export type EmbeddingPluginOutput =
  | { mode: "single"; embedding: number[] | null }
  | { mode: "batch"; results: Array<{ id: string | number; embedding: number[] | null }> };

function hasUsableApiKey(value: string | undefined): boolean {
  const key = value?.trim().toLowerCase();
  if (!key) return false;
  return !(
    key.includes("placeholder") ||
    key.includes("inactive") ||
    key.includes("changeme") ||
    key.includes("dummy") ||
    key.startsWith("your_")
  );
}

function hasConfig(): boolean {
  return hasUsableApiKey(process.env.AI_INTEGRATIONS_OPENAI_API_KEY) ||
    hasUsableApiKey(process.env.OPENROUTER_API_KEY);
}

export const embeddingDefaultPlugin: AIPlugin<EmbeddingPluginInput, EmbeddingPluginOutput> = {
  id: "embedding-openai",
  capability: "embedding",
  version: "1.0.0",
  provider: hasUsableApiKey(process.env.AI_INTEGRATIONS_OPENAI_API_KEY) ? "openai" : "openrouter",

  async init(): Promise<void> {
    if (!hasConfig()) {
      throw new Error("Need AI_INTEGRATIONS_OPENAI_API_KEY or OPENROUTER_API_KEY for embedding-openai");
    }
  },

  async health(): Promise<AIPluginHealth> {
    if (!hasConfig()) return { ok: false, message: "no API key configured" };
    const t0 = Date.now();
    const vec = await generateEmbedding("ping");
    return {
      ok: Array.isArray(vec) && vec.length > 0,
      latencyMs: Date.now() - t0,
      ...(vec ? {} : { message: "embedding returned null" }),
    };
  },

  async execute(input: EmbeddingPluginInput): Promise<EmbeddingPluginOutput> {
    if (input.mode === "single") {
      const embedding = await generateEmbedding(input.text);
      return { mode: "single", embedding };
    }
    const results = await generateEmbeddingsBatch(input.items);
    return { mode: "batch", results };
  },
};
