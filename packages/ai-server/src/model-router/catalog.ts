import { logger } from "../logger";

export type ModelTier = "nano" | "micro" | "standard" | "reasoning" | "premium";
export type ModelProvider = "openai" | "groq" | "openrouter" | "anthropic";
export type ModelCapability =
  | "chat"
  | "tool-use"
  | "long-context"
  | "thinking"
  | "vision"
  | "audio-out"
  | "fast";

export interface ModelEntry {
  id: string;
  provider: ModelProvider;
  tier: ModelTier;
  contextWindow: number;
  costPer1MIn: number;
  costPer1MOut: number;
  capabilities: ModelCapability[];
  addedAt: string;
  deprecated?: boolean;
  notes?: string;
}

const DEFAULT_CATALOG: ModelEntry[] = [
  {
    id: "llama-3.1-8b-instant",
    provider: "groq",
    tier: "nano",
    contextWindow: 128_000,
    costPer1MIn: 0,
    costPer1MOut: 0,
    capabilities: ["chat", "fast"],
    addedAt: "2024-09-01",
  },
  {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    tier: "micro",
    contextWindow: 128_000,
    costPer1MIn: 0,
    costPer1MOut: 0,
    capabilities: ["chat", "tool-use", "fast"],
    addedAt: "2024-12-01",
  },
  {
    id: "openrouter/free",
    provider: "openrouter",
    tier: "standard",
    contextWindow: 32_000,
    costPer1MIn: 0,
    costPer1MOut: 0,
    capabilities: ["chat"],
    addedAt: "2025-01-01",
    notes: "Generic OpenRouter free routing alias",
  },
  {
    id: "deepseek/deepseek-r1:free",
    provider: "openrouter",
    tier: "reasoning",
    contextWindow: 64_000,
    costPer1MIn: 0,
    costPer1MOut: 0,
    capabilities: ["chat", "thinking", "long-context"],
    addedAt: "2025-01-20",
  },
  {
    id: "gpt-4o-mini",
    provider: "openai",
    tier: "standard",
    contextWindow: 128_000,
    costPer1MIn: 0.15,
    costPer1MOut: 0.6,
    capabilities: ["chat", "tool-use", "vision"],
    addedAt: "2024-07-18",
  },
  {
    id: "gpt-4o",
    provider: "openai",
    tier: "premium",
    contextWindow: 128_000,
    costPer1MIn: 2.5,
    costPer1MOut: 10,
    capabilities: ["chat", "tool-use", "vision", "long-context"],
    addedAt: "2024-05-13",
  },
  {
    id: "anthropic/claude-opus-4-7",
    provider: "openrouter",
    tier: "reasoning",
    contextWindow: 200_000,
    costPer1MIn: 15,
    costPer1MOut: 75,
    capabilities: ["chat", "tool-use", "thinking", "long-context", "vision"],
    addedAt: "2026-04-01",
    notes: "Available also via direct Anthropic API when ANTHROPIC_API_KEY is set",
  },
];

let runtimeCatalog: ModelEntry[] = [...DEFAULT_CATALOG];

export function getCatalog(): ModelEntry[] {
  return runtimeCatalog.filter((e) => !e.deprecated);
}

export function getAllCatalogEntries(): ModelEntry[] {
  return [...runtimeCatalog];
}

export interface FindModelOptions {
  tier?: ModelTier;
  provider?: ModelProvider;
  minContext?: number;
  capability?: ModelCapability;
  excludePaid?: boolean;
}

export function findModel(opts: FindModelOptions): ModelEntry | undefined {
  const candidates = getCatalog().filter((m) => {
    if (opts.tier && m.tier !== opts.tier) return false;
    if (opts.provider && m.provider !== opts.provider) return false;
    if (opts.minContext && m.contextWindow < opts.minContext) return false;
    if (opts.capability && !m.capabilities.includes(opts.capability)) return false;
    if (opts.excludePaid && (m.costPer1MIn > 0 || m.costPer1MOut > 0)) return false;
    return true;
  });
  return candidates.sort((a, b) => {
    const costA = a.costPer1MIn + a.costPer1MOut;
    const costB = b.costPer1MIn + b.costPer1MOut;
    if (costA !== costB) return costA - costB;
    return b.contextWindow - a.contextWindow;
  })[0];
}

export function findModelById(id: string): ModelEntry | undefined {
  return runtimeCatalog.find((m) => m.id === id);
}

export interface CatalogPatch {
  added?: ModelEntry[];
  deprecated?: string[];
}

export function applyCatalogPatch(patch: CatalogPatch): { added: number; deprecated: number } {
  let added = 0;
  let deprecated = 0;
  if (patch.added) {
    for (const entry of patch.added) {
      const existing = runtimeCatalog.findIndex((m) => m.id === entry.id);
      if (existing >= 0) {
        runtimeCatalog[existing] = entry;
      } else {
        runtimeCatalog.push(entry);
        added += 1;
      }
    }
  }
  if (patch.deprecated) {
    for (const id of patch.deprecated) {
      const entry = runtimeCatalog.find((m) => m.id === id);
      if (entry && !entry.deprecated) {
        entry.deprecated = true;
        deprecated += 1;
      }
    }
  }
  if (added > 0 || deprecated > 0) {
    logger.info({ added, deprecated }, "[model-catalog] patched");
  }
  return { added, deprecated };
}

export interface DiscoveryReport {
  checkedAt: string;
  candidates: ModelEntry[];
  source: "local" | "remote";
  message?: string;
}

export async function refreshCatalog(): Promise<DiscoveryReport> {
  return {
    checkedAt: new Date().toISOString(),
    candidates: [],
    source: "local",
    message: "remote discovery not implemented yet — catalog driven by default seed",
  };
}

export function _resetCatalogForTest(): void {
  runtimeCatalog = [...DEFAULT_CATALOG];
}
