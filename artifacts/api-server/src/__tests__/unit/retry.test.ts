import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── withRetry inline (da estrarre in lib/ai/utils/retry.ts) ─────────────────
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelayMs?: number;
    retryOn?: (err: unknown) => boolean;
  } = {},
): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 10, retryOn = isRetryable } = options;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts || !retryOn(err)) throw err;
      const delay = baseDelayMs * 2 ** attempt + Math.random() * baseDelayMs;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('429') ||
           err.message.includes('timeout') ||
           err.message.includes('ECONNRESET');
  }
  return false;
}

describe('withRetry', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('ritorna il risultato al primo tentativo se ha successo', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('riprova su errori retryable (429)', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('429 rate limit'))
      .mockResolvedValueOnce('ok dopo retry');

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('ok dopo retry');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('NON riprova su errori non-retryable', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('invalid API key'));
    await expect(withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })).rejects.toThrow('invalid API key');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('lancia dopo maxAttempts tentativi falliti', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('timeout'));
    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 });
    await vi.runAllTimersAsync();
    await expect(promise).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('supporta retryOn custom', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('custom retryable error'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      retryOn: (e) => e instanceof Error && e.message.includes('custom retryable'),
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
