// Type shims per moduli senza @types nel pacchetto server.

declare module "stripe" {
  class Stripe {
    constructor(apiKey: string, options?: Record<string, unknown>);
    webhooks: {
      constructEvent(payload: string | Buffer, sig: string, secret: string): {
        type: string;
        data: { object: Record<string, unknown> };
        [key: string]: unknown;
      };
    };
  }
  export = Stripe;
}
// opossum e pg sono usati in packages/db/src/index.ts come deps runtime.

declare module "opossum" {
  type AnyFn = (...args: unknown[]) => Promise<unknown>;
  class CircuitBreaker {
    constructor(action: AnyFn, options?: Record<string, unknown>);
    fire<T>(...args: unknown[]): Promise<T>;
    on(event: string, fn: (...args: unknown[]) => void): this;
    fallback(fn: AnyFn): this;
  }
  export = CircuitBreaker;
}

declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    [k: string]: unknown;
  }
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number | null;
    command: string;
  }
  export interface PoolClient {
    query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
    release(): void;
  }
  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
    end(): Promise<void>;
    readonly totalCount: number;
    readonly idleCount: number;
    readonly waitingCount: number;
  }
}
