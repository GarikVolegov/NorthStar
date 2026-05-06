/**
 * OpenTelemetry instrumentation for the NorthStar API server.
 *
 * IMPORTANT: This file must be imported BEFORE any other module in index.ts
 * because OTel patches Node.js core modules at startup.
 *
 * Usage in index.ts (first line):
 *   import "./lib/telemetry.js";
 *
 * Environment variables:
 *   OTEL_SERVICE_NAME        defaults to "northstar-api"
 *   OTEL_EXPORTER_OTLP_ENDPOINT  defaults to "http://localhost:4318" (Jaeger)
 *
 * When OTEL_EXPORTER_OTLP_ENDPOINT is not set in production, tracing is disabled
 * gracefully (no crash, just a warning log).
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const serviceName = process.env.OTEL_SERVICE_NAME ?? "northstar-api";

if (!endpoint) {
  console.warn(
    "[telemetry] OTEL_EXPORTER_OTLP_ENDPOINT not set — distributed tracing disabled."
  );
} else {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version ?? "0.0.0",
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Reduce noise: disable fs instrumentation (too chatty)
        "@opentelemetry/instrumentation-fs": { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Flush traces on shutdown
  process.on("SIGTERM", () => {
    sdk.shutdown().catch((err) => console.error("[telemetry] shutdown error", err));
  });

  console.info(`[telemetry] OpenTelemetry started — service=${serviceName} endpoint=${endpoint}`);
}
