/**
 * wendyPersistence.ts — persistenza locale della chat Wendy.
 *
 * Salva ultime N coppie user/assistant in localStorage con schema versionato.
 * Le entries scadono dopo TTL_MS per evitare che chat vecchie restino indefinitamente.
 */
import { clientLogger } from '../lib/clientLogger';

export type WendyHistoryEntry = { role: 'user' | 'assistant'; content: string };

interface PersistedThread {
  v: 1;
  history: WendyHistoryEntry[];
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

export function loadPersistedThread(): { history: WendyHistoryEntry[]; summary?: string } | null {
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
    const history = parsed.history
      .filter((e): e is WendyHistoryEntry =>
        Boolean(e) &&
        (e.role === 'user' || e.role === 'assistant') &&
        typeof e.content === 'string',
      )
      .slice(-MAX_TURNS);
    return parsed.summary
      ? { history, summary: parsed.summary }
      : { history };
  } catch (err) {
    clientLogger.warn('[wendyPersistence] load failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function savePersistedThread(history: WendyHistoryEntry[], summary?: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const payload: PersistedThread = {
      v: 1,
      history: history.slice(-MAX_TURNS),
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
