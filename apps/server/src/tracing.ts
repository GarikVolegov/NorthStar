/**
 * OpenTelemetry tracing initialization.
 *
 * Must be imported BEFORE any other module to ensure instrumentation
 * wraps modules at load time.
 *
 * Usage (in index.ts):
 *   import "./tracing"; // first import
 *
 * Env vars:
 *   OTEL_SERVICE_NAME    — service name for Jaeger (default: northstar-server)
 *   OTEL_EXPORTER_OTLP_ENDPOINT — OTLP endpoint (default: http://localhost:4318)
 *   OTEL_DISABLED        — set to "true" to disable tracing entirely
 */

import { rootLogger } from "./middleware/logger";

const isVercel = Boolean(process.env.VERCEL);
const hasExplicitEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
const isDisabled = process.env.OTEL_DISABLED === "true" || (isVercel && !hasExplicitEndpoint);

if (!isDisabled) {
  // Dynamic import to avoid crash when @opentelemetry packages are missing
  (async () => {
    try {
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      const { OTLPTraceExporter } =
        await import("@opentelemetry/exporter-trace-otlp-http");
      const getNodeAutoInstrumentations =
        (await import("@opentelemetry/auto-instrumentations-node"))
          .getNodeAutoInstrumentations || (() => []);
      const { ExpressInstrumentation } =
        await import("@opentelemetry/instrumentation-express");
      const { diag, DiagConsoleLogger, DiagLogLevel } =
        await import("@opentelemetry/api");

      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

      const sdk = new NodeSDK({
        traceExporter: new OTLPTraceExporter({
          url: `${
            process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318"
          }/v1/traces`,
        }),
        instrumentations: [
          ...getNodeAutoInstrumentations(),
          new ExpressInstrumentation(),
        ],
      });

      await sdk.start();
      rootLogger.info("[tracing] OpenTelemetry started");

      process.on("SIGTERM", () => {
        sdk.shutdown().catch(() => {});
      });
      process.on("SIGINT", () => {
        sdk.shutdown().catch(() => {});
      });
    } catch (err) {
      rootLogger.warn({ err }, "[tracing] OpenTelemetry not available — tracing disabled");
    }
  })();
}
