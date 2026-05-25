declare module "opossum" {
  export default class CircuitBreaker<T extends (...args: unknown[]) => Promise<unknown>> {
    constructor(action: T, options?: Record<string, unknown>);
    fire(...args: Parameters<T>): ReturnType<T>;
    on(event: string, listener: (...args: unknown[]) => void): this;
  }
}

declare module "pg" {
  export interface QueryResult<T = Record<string, unknown>> {
    rows: T[];
    rowCount: number | null;
  }

  export interface PoolClient {
    query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    release(): void;
  }

  export class Pool {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
    constructor(config?: Record<string, unknown>);
    connect(): Promise<PoolClient>;
    query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
    end(): Promise<void>;
  }
}
