/// <reference path="../../db/src/vendor.d.ts" />

declare module "@opentelemetry/instrumentation" {
  export function registerInstrumentations(options: { instrumentations: unknown[] }): void;
}

declare module "@opentelemetry/auto-instrumentations-node" {
  export function getNodeAutoInstrumentations(options?: Record<string, unknown>): unknown;
}
