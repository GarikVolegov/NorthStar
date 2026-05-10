/**
 * CircuitBreaker — zero-dependency state machine.
 *
 * States:
 *   CLOSED    → normal operation, failures are counted
 *   OPEN      → breaker tripped, all calls rejected immediately with fallback
 *   HALF_OPEN → after cooldown, one probe call is allowed through;
 *               success → CLOSED, failure → back to OPEN
 *
 * Usage:
 *   const cb = new CircuitBreaker({ name: 'openai', failureThreshold: 5,
 *                                   cooldownMs: 60_000, callTimeoutMs: 30_000 });
 *   const result = await cb.fire(() => myAsyncFn());
 *
 * The breaker emits four events via the onStateChange callback:
 *   'open' | 'half-open' | 'closed' | 'timeout'
 */

export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  /** Human-readable name (used in logs) */
  name: string;
  /** Consecutive failures before tripping OPEN (default: 5) */
  failureThreshold?: number;
  /** Milliseconds to wait before moving to HALF_OPEN (default: 60_000) */
  cooldownMs?: number;
  /** Per-call timeout in ms; exceeded calls count as failures (default: 30_000) */
  callTimeoutMs?: number;
  /** Optional callback fired on every state transition */
  onStateChange?: (name: string, from: BreakerState, to: BreakerState) => void;
}

export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;
  private readonly callTimeoutMs: number;
  private readonly onStateChange?: (name: string, from: BreakerState, to: BreakerState) => void;

  private state: BreakerState = 'CLOSED';
  private failureCount   = 0;
  private lastFailureAt  = 0;
  private halfOpenProbe  = false; // true while a HALF_OPEN probe is in flight

  constructor(opts: CircuitBreakerOptions) {
    this.name             = opts.name;
    this.failureThreshold = opts.failureThreshold ?? 5;
    this.cooldownMs       = opts.cooldownMs       ?? 60_000;
    this.callTimeoutMs    = opts.callTimeoutMs    ?? 30_000;
    this.onStateChange    = opts.onStateChange;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  getState(): BreakerState { return this.state; }
  getFailureCount(): number { return this.failureCount; }

  /**
   * Execute `fn`. Returns its result on success.
   * Throws `CircuitOpenError` if the breaker is OPEN (and not yet ready to probe).
   * Throws the original error (and records it) if `fn` rejects or times out.
   */
  async fire<T>(fn: () => Promise<T>): Promise<T> {
    this.maybeTransitionToHalfOpen();

    if (this.state === 'OPEN') {
      throw new CircuitOpenError(
        `Circuit '${this.name}' is OPEN — calls rejected until cooldown expires.`
      );
    }

    // In HALF_OPEN only one probe is allowed at a time
    if (this.state === 'HALF_OPEN' && this.halfOpenProbe) {
      throw new CircuitOpenError(
        `Circuit '${this.name}' is HALF_OPEN — probe already in flight.`
      );
    }

    if (this.state === 'HALF_OPEN') this.halfOpenProbe = true;

    try {
      const result = await this.withTimeout(fn);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err instanceof TimeoutError ? 'timeout' : 'error');
      throw err;
    } finally {
      if (this.state === 'HALF_OPEN') this.halfOpenProbe = false;
    }
  }

  /** Manually reset the breaker to CLOSED (useful in tests / admin routes). */
  reset(): void {
    this.transitionTo('CLOSED');
    this.failureCount = 0;
    this.lastFailureAt = 0;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private maybeTransitionToHalfOpen(): void {
    if (
      this.state === 'OPEN' &&
      Date.now() - this.lastFailureAt >= this.cooldownMs
    ) {
      this.transitionTo('HALF_OPEN');
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.transitionTo('CLOSED');
    }
    this.failureCount = 0;
  }

  private onFailure(reason: 'error' | 'timeout'): void {
    this.failureCount++;
    this.lastFailureAt = Date.now();
    console.warn(
      `[CircuitBreaker:${this.name}] failure #${this.failureCount} (${reason})`
    );

    if (
      this.state === 'HALF_OPEN' ||
      this.failureCount >= this.failureThreshold
    ) {
      this.transitionTo('OPEN');
    }
  }

  private transitionTo(next: BreakerState): void {
    if (this.state === next) return;
    const prev = this.state;
    this.state = next;
    console.log(
      `[CircuitBreaker:${this.name}] ${prev} → ${next}`
    );
    this.onStateChange?.(this.name, prev, next);
  }

  private withTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TimeoutError(
          `Circuit '${this.name}': call timed out after ${this.callTimeoutMs}ms`
        ));
      }, this.callTimeoutMs);

      fn().then(
        (v) => { clearTimeout(timer); resolve(v); },
        (e) => { clearTimeout(timer); reject(e); }
      );
    });
  }
}

// ── Custom error classes ───────────────────────────────────────────────────

export class CircuitOpenError extends Error {
  readonly isCircuitOpen = true;
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

export class TimeoutError extends Error {
  readonly isTimeout = true;
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
