import type { AIPlugin, AIPluginHealth } from "../types";

export interface SemanticMemoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface SemanticMemoryResult {
  id: string;
  content: string;
  score?: number;
  updatedAt?: string;
  source: "mem0";
}

export type MemoryMem0Input =
  | {
      op: "recall";
      userId: number;
      query: string;
      limit?: number;
    }
  | {
      op: "store";
      userId: number;
      turns: SemanticMemoryTurn[];
    };

export type MemoryMem0Output =
  | { op: "recall"; memories: SemanticMemoryResult[] }
  | { op: "store"; stored: boolean };

function getBaseUrl(): string {
  return (process.env.MEM0_BASE_URL ?? "https://api.mem0.ai/v1").replace(/\/+$/u, "");
}

function getApiKey(): string | undefined {
  return process.env.MEM0_API_KEY?.trim() || undefined;
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Token ${apiKey}`,
    "Content-Type": "application/json",
  };
}

function clampLimit(limit: number | undefined): number {
  if (!limit || !Number.isFinite(limit)) return 5;
  return Math.max(1, Math.min(12, Math.floor(limit)));
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function extractMemoryItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const record = readRecord(raw);
  if (!record) return [];
  const candidates = [record.results, record.memories, record.data];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function normalizeMemory(raw: unknown): SemanticMemoryResult | null {
  const record = readRecord(raw);
  if (!record) return null;
  const content =
    readString(record, "memory") ??
    readString(record, "content") ??
    readString(record, "text");
  if (!content) return null;
  const score = readNumber(record, "score");
  const updatedAt = readString(record, "updated_at");
  return {
    id: readString(record, "id") ?? `mem0-${content.slice(0, 24)}`,
    content,
    ...(score !== undefined ? { score } : {}),
    ...(updatedAt ? { updatedAt } : {}),
    source: "mem0",
  };
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Mem0 request failed with status ${response.status}: ${text.slice(0, 160)}`);
  }
  if (!text.trim()) return {};
  return JSON.parse(text) as unknown;
}

async function recall(input: Extract<MemoryMem0Input, { op: "recall" }>): Promise<MemoryMem0Output> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("MEM0_API_KEY missing");
  const response = await fetch(`${getBaseUrl()}/memories/search`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      query: input.query,
      user_id: String(input.userId),
      limit: clampLimit(input.limit),
    }),
  });
  const raw = await parseJsonResponse(response);
  return {
    op: "recall",
    memories: extractMemoryItems(raw)
      .map((item) => normalizeMemory(item))
      .filter((item): item is SemanticMemoryResult => item !== null),
  };
}

async function store(input: Extract<MemoryMem0Input, { op: "store" }>): Promise<MemoryMem0Output> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("MEM0_API_KEY missing");
  const text = input.turns
    .map((turn) => `${turn.role === "user" ? "Utente" : "Wendy"}: ${turn.content}`)
    .join("\n")
    .trim();
  if (!text) return { op: "store", stored: false };

  await parseJsonResponse(
    await fetch(`${getBaseUrl()}/memories`, {
      method: "POST",
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        messages: input.turns.map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        user_id: String(input.userId),
        metadata: { source: "northstar_wendy" },
      }),
    }),
  );

  return { op: "store", stored: true };
}

export function isMemoryMem0Available(): boolean {
  return Boolean(getApiKey());
}

export function createMemoryMem0Plugin(): AIPlugin<MemoryMem0Input, MemoryMem0Output> {
  return {
    id: "memory-mem0",
    capability: "memory",
    version: "1.0.0",
    provider: "mem0",

    async init(): Promise<void> {
      if (!isMemoryMem0Available()) throw new Error("MEM0_API_KEY missing for memory-mem0");
    },

    async health(): Promise<AIPluginHealth> {
      const apiKey = getApiKey();
      if (!apiKey) return { ok: false, message: "MEM0_API_KEY missing" };
      const t0 = Date.now();
      try {
        const response = await fetch(`${getBaseUrl()}/memories/search`, {
          method: "POST",
          headers: authHeaders(apiKey),
          body: JSON.stringify({ query: "ping", user_id: "health", limit: 1 }),
        });
        return {
          ok: response.ok,
          latencyMs: Date.now() - t0,
          ...(response.ok ? {} : { message: `status ${response.status}` }),
        };
      } catch (err) {
        return {
          ok: false,
          latencyMs: Date.now() - t0,
          message: err instanceof Error ? err.message : String(err),
        };
      }
    },

    async execute(input: MemoryMem0Input): Promise<MemoryMem0Output> {
      if (input.op === "recall") return recall(input);
      return store(input);
    },
  };
}

export const memoryMem0Plugin = createMemoryMem0Plugin();
