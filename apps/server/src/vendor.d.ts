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

declare module "qrcode" {
  export interface QRCodeToDataURLOptions {
    errorCorrectionLevel?: string;
    margin?: number;
    width?: number;
    color?: Record<string, string>;
  }

  export function toDataURL(
    text: string,
    options?: QRCodeToDataURLOptions,
  ): Promise<string>;

  export function toString(
    text: string,
    options?: QRCodeToDataURLOptions & { type?: "svg" | "terminal" | "utf8" },
  ): Promise<string>;
}

declare module "@opentelemetry/sdk-node" {
  export class NodeSDK {
    constructor(options?: {
      serviceName?: string;
      traceExporter?: unknown;
      instrumentations?: unknown[];
    });
    start(): Promise<void> | void;
    shutdown(): Promise<void>;
  }
}

declare module "@opentelemetry/exporter-trace-otlp-http" {
  export class OTLPTraceExporter {
    constructor(options?: { url?: string });
  }
}

declare module "@opentelemetry/auto-instrumentations-node" {
  export function getNodeAutoInstrumentations(
    options?: Record<string, unknown>,
  ): unknown[];
}

declare module "@opentelemetry/instrumentation-express" {
  export class ExpressInstrumentation {
    constructor(options?: Record<string, unknown>);
  }
}
