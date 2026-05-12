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

const isDisabled = process.env.OTEL_DISABLED === "true";

if (!isDisabled) {
  // Dynamic import to avoid crash when @opentelemetry packages are missing
  (async () => {
    try {
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
      const { getNodeAutoInstrumentations } = await import("@opentelemetry/instrumentation-http");
      const { ExpressInstrumentation } = await import("@opentelemetry/instrumentation-express");
      const { diag, DiagConsoleLogger, DiagLogLevel } = await import("@opentelemetry/api");

      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

      const sdk = new NodeSDK({
        serviceName: process.env.OTEL_SERVICE_NAME ?? "northstar-server",
        traceExporter: new OTLPTraceExporter({
          url: `${
            process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318"
          }/v1/traces`,
        }),
        instrumentations: [
          getNodeAutoInstrumentations(),
          new ExpressInstrumentation(),
        ],
      });

      await sdk.start();
      console.log("[tracing] OpenTelemetry started");

      process.on("SIGTERM", () => {
        sdk.shutdown().catch(() => {});
      });
      process.on("SIGINT", () => {
        sdk.shutdown().catch(() => {});
      });
    } catch (err) {
      console.warn("[tracing] OpenTelemetry not available — tracing disabled:", (err as Error).message);
    }
  })();
}
