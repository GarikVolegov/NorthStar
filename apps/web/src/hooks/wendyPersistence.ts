/**
 * wendyPersistence.ts — persistenza locale della chat Wendy.
 *
 * Salva ultime N coppie user/assistant in localStorage con schema versionato.
 * Le entries scadono dopo TTL_MS per evitare che chat vecchie restino indefinitamente.
 */
import { clientLogger } from '../lib/clientLogger';
import type { ChatMessage } from './useWendyChat.types';

export type WendyHistoryEntry = { role: 'user' | 'assistant'; content: string };

interface PersistedThread {
  v: 1;
  history: WendyHistoryEntry[];
  messages?: ChatMessage[];
  summary?: string;
  savedAt: number;
}

const STORAGE_KEY = 'wendy:thread:v1';
const MAX_TURNS = 40; // 20 coppie user/assistant
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 giorni

function isPersistedThread(value: unknown): value is PersistedThread {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  return (
    t.v === 1 &&
    Array.isArray(t.history) &&
    typeof t.savedAt === 'number'
  );
}

function sanitizeHistory(history: unknown[]): WendyHistoryEntry[] {
  return history
    .filter((e): e is WendyHistoryEntry =>
      Boolean(e) &&
      typeof e === 'object' &&
      ((e as WendyHistoryEntry).role === 'user' || (e as WendyHistoryEntry).role === 'assistant') &&
      typeof (e as WendyHistoryEntry).content === 'string',
    )
    .slice(-MAX_TURNS);
}

function sanitizeMessages(messages: unknown): ChatMessage[] | undefined {
  if (!Array.isArray(messages)) return undefined;
  const sanitized = messages
    .filter((message): message is ChatMessage => {
      if (!message || typeof message !== 'object') return false;
      const item = message as Partial<ChatMessage>;
      return (
        typeof item.id === 'string' &&
        (item.role === 'user' || item.role === 'assistant' || item.role === 'error') &&
        typeof item.content === 'string' &&
        typeof item.timestamp === 'number'
      );
    })
    .map((message) => (
      message.isStreaming ? { ...message, isStreaming: false } : message
    ))
    .slice(-MAX_TURNS);
  return sanitized.length > 0 ? sanitized : undefined;
}

function messagesFromHistory(history: WendyHistoryEntry[], savedAt: number): ChatMessage[] | undefined {
  if (history.length === 0) return undefined;
  return history.map((entry, index) => ({
    id: `persisted-${entry.role}-${index}`,
    role: entry.role,
    content: entry.content,
    timestamp: savedAt + index,
  }));
}

export function loadPersistedThread(): { history: WendyHistoryEntry[]; messages?: ChatMessage[]; summary?: string } | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedThread(parsed)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() - parsed.savedAt > TTL_MS) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    const history = sanitizeHistory(parsed.history);
    const messages = sanitizeMessages(parsed.messages) ?? messagesFromHistory(history, parsed.savedAt);
    return {
      history,
      ...(messages ? { messages } : {}),
      ...(parsed.summary ? { summary: parsed.summary } : {}),
    };
  } catch (err) {
    clientLogger.warn('[wendyPersistence] load failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function savePersistedThread(
  history: WendyHistoryEntry[],
  summary?: string,
  messages?: ChatMessage[],
): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const visibleMessages = sanitizeMessages(messages);
    const payload: PersistedThread = {
      v: 1,
      history: sanitizeHistory(history),
      ...(visibleMessages ? { messages: visibleMessages } : {}),
      ...(summary ? { summary } : {}),
      savedAt: Date.now(),
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // QuotaExceededError o simile: degradiamo silenziosamente, la chat resta in RAM
    clientLogger.warn('[wendyPersistence] save failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function clearPersistedThread(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    clientLogger.warn('[wendyPersistence] clear failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function hasRecentPersistedThread(maxAgeMs = 24 * 60 * 60 * 1000): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    if (!isPersistedThread(parsed)) return false;
    if (parsed.history.length === 0) return false;
    return Date.now() - parsed.savedAt <= maxAgeMs;
  } catch {
    return false;
  }
}
