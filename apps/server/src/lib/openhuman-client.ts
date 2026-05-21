export type OpenHumanConnectionState =
  | "disabled"
  | "connected"
  | "unreachable"
  | "error";

export interface OpenHumanStatus {
  enabled: boolean;
  state: OpenHumanConnectionState;
  configured: boolean;
  coreUrl: string | null;
  version?: string | null;
  message?: string;
  checkedAt: string;
}

export interface OpenHumanMemoryResult {
  id: string;
  title: string;
  content: string;
  score: number | null;
  source: "openhuman";
  url: string | null;
  updatedAt: string | null;
}

export interface OpenHumanMessageResponse {
  message: string;
  sources: OpenHumanMemoryResult[];
}

export interface OpenHumanSyncResponse {
  status: "started" | "running" | "completed" | "unavailable";
  message: string;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: string;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
}

const DEFAULT_TIMEOUT_MS = 8_000;

export function isOpenHumanEnabled(): boolean {
  return process.env.OPENHUMAN_ENABLED === "true";
}

function timeoutMs(): number {
  const parsed = Number.parseInt(
    process.env.OPENHUMAN_TIMEOUT_MS ?? "",
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function coreUrl(): string | null {
  const url = process.env.OPENHUMAN_CORE_RPC_URL?.trim();
  return url ? url.replace(/\/+$/, "") : null;
}

function authHeaders(): Record<string, string> {
  const token = process.env.OPENHUMAN_CORE_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeMemoryResult(value: unknown, index: number): OpenHumanMemoryResult {
  const record = asRecord(value) ?? {};
  const id = readString(record.id) ?? readString(record.uuid) ?? `openhuman-${index}`;
  const title =
    readString(record.title) ??
    readString(record.name) ??
    readString(record.sourceTitle) ??
    "Memoria OpenHuman";
  const content =
    readString(record.content) ??
    readString(record.text) ??
    readString(record.summary) ??
    "";

  return {
    id,
    title,
    content,
    score: readNumber(record.score),
    source: "openhuman",
    url: readString(record.url),
    updatedAt: readString(record.updatedAt) ?? readString(record.updated_at),
  };
}

function normalizeMemoryList(value: unknown): OpenHumanMemoryResult[] {
  const record = asRecord(value);
  const raw = Array.isArray(value)
    ? value
    : Array.isArray(record?.results)
      ? record.results
      : Array.isArray(record?.items)
        ? record.items
        : Array.isArray(record?.memories)
          ? record.memories
          : [];

  return raw
    .map(normalizeMemoryResult)
    .filter((item) => item.content || item.title);
}

async function callOpenHuman(method: string, params?: Record<string, unknown>): Promise<unknown> {
  const url = coreUrl();
  if (!isOpenHumanEnabled()) {
    throw new Error("OPENHUMAN_DISABLED");
  }
  if (!url) {
    throw new Error("OPENHUMAN_NOT_CONFIGURED");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `${Date.now()}-${method}`,
        method,
        params: params ?? {},
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OPENHUMAN_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as JsonRpcResponse;
    if (payload.error) {
      throw new Error(payload.error.message ?? "OPENHUMAN_RPC_ERROR");
    }
    return payload.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function getOpenHumanStatus(): Promise<OpenHumanStatus> {
  const enabled = isOpenHumanEnabled();
  const url = coreUrl();
  const checkedAt = new Date().toISOString();

  if (!enabled) {
    return {
      enabled: false,
      state: "disabled",
      configured: Boolean(url),
      coreUrl: url,
      message: "OpenHuman non e` abilitato per questo ambiente.",
      checkedAt,
    };
  }

  if (!url) {
    return {
      enabled: true,
      state: "error",
      configured: false,
      coreUrl: null,
      message: "OPENHUMAN_CORE_RPC_URL non configurato.",
      checkedAt,
    };
  }

  try {
    const result = asRecord(await callOpenHuman("health.check"));
    return {
      enabled: true,
      state: "connected",
      configured: true,
      coreUrl: url,
      version: readString(result?.version),
      message: readString(result?.message) ?? "OpenHuman raggiungibile.",
      checkedAt,
    };
  } catch (err) {
    return {
      enabled: true,
      state: err instanceof Error && err.message.startsWith("OPENHUMAN_HTTP_")
        ? "error"
        : "unreachable",
      configured: true,
      coreUrl: url,
      message: err instanceof Error ? err.message : "OpenHuman non raggiungibile.",
      checkedAt,
    };
  }
}

export async function searchOpenHumanMemory(
  query: string,
  userId: number,
  limit = 5,
): Promise<OpenHumanMemoryResult[]> {
  if (!query.trim()) return [];
  const result = await callOpenHuman("memory.search", {
    query,
    userId,
    limit,
  });
  return normalizeMemoryList(result).slice(0, limit);
}

export async function sendOpenHumanMessage(
  message: string,
  userId: number,
): Promise<OpenHumanMessageResponse> {
  const result = asRecord(
    await callOpenHuman("agent.message", {
      message,
      userId,
    }),
  );
  return {
    message:
      readString(result?.message) ??
      readString(result?.content) ??
      "OpenHuman ha ricevuto il messaggio.",
    sources: normalizeMemoryList(result?.sources),
  };
}

export async function startOpenHumanSync(userId: number): Promise<OpenHumanSyncResponse> {
  const result = asRecord(await callOpenHuman("sync.start", { userId }));
  return {
    status:
      result?.status === "running" ||
      result?.status === "completed" ||
      result?.status === "unavailable"
        ? result.status
        : "started",
    message:
      readString(result?.message) ??
      "Sincronizzazione OpenHuman avviata.",
  };
}

export async function buildOpenHumanContext(
  query: string,
  userId: number,
): Promise<string> {
  try {
    const results = await searchOpenHumanMemory(query, userId, 4);
    if (results.length === 0) return "";
    const lines = results.map((item, index) => {
      const score = item.score === null ? "" : ` score=${item.score}`;
      return `${index + 1}. [source: openhuman${score}] ${item.title}: ${item.content}`;
    });
    return `\n\n## Contesto OpenHuman\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}
