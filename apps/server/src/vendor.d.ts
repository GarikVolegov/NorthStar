/// <reference path="../../../packages/db/src/vendor.d.ts" />

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
