export interface WendySseRagCitation {
  nodeId: number;
  title: string;
  type: string;
  score: number;
  url: string | null;
}

export type WendyContextSource = 'app-data' | 'rag' | 'openhuman' | 'graphify' | 'semantic-memory';

export type WendySseEvent =
  | { type: 'status'; value: string }
  | { type: 'gate'; message: string }
  | { type: 'error'; message: string }
  | { type: 'rag_citations'; citations: WendySseRagCitation[] }
  | { type: 'done'; requestId?: string | undefined; contextSources: WendyContextSource[] }
  | { type: 'tool_call'; name: string; args?: Record<string, unknown> | undefined; result?: unknown }
  | { type: 'ui_tool'; name: string; args: Record<string, unknown> }
  | { type: 'token'; value: string }
  | { type: 'unknown' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readStringField(record: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

export function readNumberField(record: Record<string, unknown> | undefined, key: string): number | undefined {
  const value = record?.[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function parseRagCitation(value: unknown): WendySseRagCitation | null {
  if (!isRecord(value)) return null;
  const nodeId = value.nodeId;
  const title = value.title;
  const type = value.type;
  const score = value.score;
  const url = value.url;
  if (
    typeof nodeId !== 'number'
    || !Number.isFinite(nodeId)
    || typeof title !== 'string'
    || typeof type !== 'string'
    || typeof score !== 'number'
    || !Number.isFinite(score)
    || !(typeof url === 'string' || url === null || url === undefined)
  ) {
    return null;
  }
  return { nodeId, title, type, score, url: url ?? null };
}

function parseRagCitations(value: unknown): WendySseRagCitation[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseRagCitation).filter((citation): citation is WendySseRagCitation => citation !== null);
}

function isWendyContextSource(value: unknown): value is WendyContextSource {
  return value === 'app-data'
    || value === 'rag'
    || value === 'openhuman'
    || value === 'graphify'
    || value === 'semantic-memory';
}

function parseContextSources(value: unknown): WendyContextSource[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isWendyContextSource))];
}

function readProviderToken(record: Record<string, unknown>): string {
  const choices: unknown[] = Array.isArray(record.choices) ? record.choices : [];
  if (choices.length === 0) return '';
  const firstChoice = choices[0];
  if (!isRecord(firstChoice)) return '';
  const delta = firstChoice.delta;
  if (!isRecord(delta)) return '';
  return typeof delta.content === 'string' ? delta.content : '';
}

export function parseWendySseEvent(raw: string): WendySseEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { type: 'unknown' };
  }

  if (!isRecord(parsed)) return { type: 'unknown' };
  const type = typeof parsed.type === 'string' ? parsed.type : undefined;

  if (type === 'status' && typeof parsed.value === 'string') {
    return { type: 'status', value: parsed.value };
  }
  if (type === 'gate') {
    return {
      type: 'gate',
      message: typeof parsed.message === 'string'
        ? parsed.message
        : 'Hai raggiunto un limite di utilizzo di Wendy.',
    };
  }
  if (type === 'error') {
    return {
      type: 'error',
      message: typeof parsed.message === 'string'
        ? parsed.message
        : 'Wendy non ha risposto correttamente.',
    };
  }
  if (type === 'rag_citations') {
    return { type: 'rag_citations', citations: parseRagCitations(parsed.citations) };
  }
  if (type === 'done') {
    return {
      type: 'done',
      requestId: typeof parsed.requestId === 'string' ? parsed.requestId : undefined,
      contextSources: parseContextSources(parsed.contextSources),
    };
  }
  if (type === 'tool_call' && typeof parsed.name === 'string') {
    return {
      type: 'tool_call',
      name: parsed.name,
      args: isRecord(parsed.args) ? parsed.args : undefined,
      result: parsed.result,
    };
  }
  if (type === 'ui_tool' && typeof parsed.name === 'string') {
    return {
      type: 'ui_tool',
      name: parsed.name,
      args: isRecord(parsed.args) ? parsed.args : {},
    };
  }

  const tokenChunk =
    type === 'token' && typeof parsed.value === 'string'
      ? parsed.value
      : type === 'token' && typeof parsed.content === 'string'
        ? parsed.content
        : type === 'token' && typeof parsed.text === 'string'
          ? parsed.text
          : readProviderToken(parsed);

  return tokenChunk ? { type: 'token', value: tokenChunk } : { type: 'unknown' };
}
