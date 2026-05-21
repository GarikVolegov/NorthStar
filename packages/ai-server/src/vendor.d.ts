declare module "opossum" {
  type AnyFunction = (...args: unknown[]) => Promise<unknown>;
  class CircuitBreaker {
    constructor(action: AnyFunction, options?: Record<string, unknown>);
    fire<T>(...args: unknown[]): Promise<T>;
    on(event: string, fn: (...args: unknown[]) => void): this;
    fallback(fn: AnyFunction): this;
  }
  export = CircuitBreaker;
}

declare module "pg" {
  export interface PoolConfig {
    connectionString?: string;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    [key: string]: unknown;
  }
  export interface QueryResult<R = Record<string, unknown>> {
    rows: R[];
    rowCount: number;
    command: string;
  }
  export interface PoolClient {
    query<R = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<R>>;
    release(): void;
  }
  export class Pool {
    constructor(config?: PoolConfig);
    connect(): Promise<PoolClient>;
    query<R = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<QueryResult<R>>;
    end(): Promise<void>;
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  }
}

declare module "@opentelemetry/instrumentation" {
  export function registerInstrumentations(options: {
    instrumentations: unknown[];
  }): void;
}

declare module "@opentelemetry/auto-instrumentations-node" {
  export function getNodeAutoInstrumentations(
    options?: Record<string, unknown>,
  ): unknown;
}
