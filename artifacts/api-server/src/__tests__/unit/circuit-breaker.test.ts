import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── CircuitBreaker inline (da estrarre in lib/ai/utils/circuit-breaker.ts) ──
type CircuitState = 'closed' | 'open' | 'half-open';

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly name: string,
    private readonly failureThreshold = 5,
    private readonly recoveryTimeMs = 30_000,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed < this.recoveryTimeMs) {
        throw new Error(`Circuit OPEN per provider ${this.name}`);
      }
      this.state = 'half-open';
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() { this.failureCount = 0; this.state = 'closed'; }
  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) this.state = 'open';
  }
  getState() { return this.state; }
  getFailureCount() { return this.failureCount; }
}

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker('test-provider', 3, 1000);
  });

  it('stato iniziale è closed', () => {
    expect(cb.getState()).toBe('closed');
  });

  it('esegue fn con successo — rimane closed', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await cb.execute(fn);
    expect(result).toBe('ok');
    expect(cb.getState()).toBe('closed');
  });

  it('apre il circuit dopo N failures consecutive', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fn)).rejects.toThrow();
    }
    expect(cb.getState()).toBe('open');
  });

  it('lancia immediatamente quando circuit è open (senza chiamare fn)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fn)).rejects.toThrow();
    }

    const fn2 = vi.fn().mockResolvedValue('ok');
    await expect(cb.execute(fn2)).rejects.toThrow('Circuit OPEN');
    expect(fn2).not.toHaveBeenCalled();
  });

  it('passa a half-open dopo il recovery time', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fn)).rejects.toThrow();
    }

    // Simula recovery time scaduto
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
    const fn2 = vi.fn().mockResolvedValue('recovered');
    const result = await cb.execute(fn2);
    expect(result).toBe('recovered');
    expect(cb.getState()).toBe('closed');
    vi.restoreAllMocks();
  });

  it('torna a closed dopo successo in half-open', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    for (let i = 0; i < 3; i++) {
      await expect(cb.execute(fn)).rejects.toThrow();
    }
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000);
    await cb.execute(vi.fn().mockResolvedValue('ok'));
    expect(cb.getState()).toBe('closed');
    expect(cb.getFailureCount()).toBe(0);
    vi.restoreAllMocks();
  });
});
