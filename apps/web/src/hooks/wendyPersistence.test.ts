import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPersistedThread,
  hasRecentPersistedThread,
  loadPersistedThread,
  savePersistedThread,
} from './wendyPersistence';

describe('wendyPersistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns null when there is nothing persisted', () => {
    expect(loadPersistedThread()).toBeNull();
    expect(hasRecentPersistedThread()).toBe(false);
  });

  it('saves and restores a thread round-trip', () => {
    savePersistedThread([
      { role: 'user', content: 'ciao' },
      { role: 'assistant', content: 'ehi' },
    ]);
    const loaded = loadPersistedThread();
    expect(loaded?.history).toHaveLength(2);
    expect(loaded?.history[0]).toEqual({ role: 'user', content: 'ciao' });
    expect(hasRecentPersistedThread()).toBe(true);
  });

  it('persists the summary alongside the history', () => {
    savePersistedThread(
      [{ role: 'user', content: 'qualcosa' }],
      'utente sta valutando un cambio carriera',
    );
    const loaded = loadPersistedThread();
    expect(loaded?.summary).toBe('utente sta valutando un cambio carriera');
  });

  it('caps the history at 40 entries', () => {
    const long = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: `msg-${i}`,
    }));
    savePersistedThread(long);
    const loaded = loadPersistedThread();
    expect(loaded?.history).toHaveLength(40);
    expect(loaded?.history[0]?.content).toBe('msg-20');
  });

  it('clearPersistedThread removes the entry', () => {
    savePersistedThread([{ role: 'user', content: 'x' }]);
    expect(loadPersistedThread()).not.toBeNull();
    clearPersistedThread();
    expect(loadPersistedThread()).toBeNull();
  });

  it('expires entries older than TTL', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    savePersistedThread([{ role: 'user', content: 'old' }]);
    expect(loadPersistedThread()).not.toBeNull();
    // 8 giorni dopo: TTL è 7 giorni
    vi.setSystemTime(new Date('2026-01-09T00:00:01Z'));
    expect(loadPersistedThread()).toBeNull();
    vi.useRealTimers();
  });

  it('hasRecentPersistedThread respects the maxAge', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    savePersistedThread([{ role: 'user', content: 'fresh' }]);
    expect(hasRecentPersistedThread()).toBe(true);
    vi.setSystemTime(new Date('2026-01-02T00:00:01Z'));
    // default maxAge è 24 ore
    expect(hasRecentPersistedThread()).toBe(false);
    vi.useRealTimers();
  });

  it('returns null if the stored payload is malformed', () => {
    window.localStorage.setItem('wendy:thread:v1', '{"v":1}'); // history missing
    expect(loadPersistedThread()).toBeNull();
    // entry malformata è anche stata cancellata
    expect(window.localStorage.getItem('wendy:thread:v1')).toBeNull();
  });

  it('returns null for an unknown version', () => {
    window.localStorage.setItem(
      'wendy:thread:v1',
      JSON.stringify({ v: 2, history: [], savedAt: Date.now() }),
    );
    expect(loadPersistedThread()).toBeNull();
  });
});
