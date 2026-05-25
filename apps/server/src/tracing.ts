/**
 * OpenTelemetry tracing initialization.
 *
 * Must be imported before the app loads Express/HTTP modules.
 *
 * Env vars:
 *   OTEL_SERVICE_NAME              - service name (default: northstar-server)
 *   OTEL_EXPORTER_OTLP_ENDPOINT    - OTLP endpoint (default: http://localhost:4318)
 *   OTEL_DISABLED                  - set to "true" to disable tracing entirely
 */

export {};

declare global {
  var __northstarOtelStarted: boolean | undefined;
}

const isVercel = Boolean(process.env.VERCEL);
const hasExplicitEndpoint = Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
const isDisabled =
  process.env.OTEL_DISABLED === "true" ||
  !hasExplicitEndpoint ||
  (isVercel && !hasExplicitEndpoint);

function traceEndpoint(): string {
  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
  return endpoint.endsWith("/v1/traces")
    ? endpoint
    : `${endpoint.replace(/\/$/, "")}/v1/traces`;
}

export const otelReady: Promise<void> =
  !isDisabled && !globalThis.__northstarOtelStarted
    ? startOpenTelemetry()
    : Promise.resolve();

function startOpenTelemetry(): Promise<void> {
  globalThis.__northstarOtelStarted = true;

  return (async () => {
    try {
      const { NodeSDK } = await import("@opentelemetry/sdk-node");
      const { OTLPTraceExporter } = await import(
        "@opentelemetry/exporter-trace-otlp-http"
      );
      const { getNodeAutoInstrumentations } = await import(
        "@opentelemetry/auto-instrumentations-node"
      );
      const { ExpressInstrumentation } = await import(
        "@opentelemetry/instrumentation-express"
      );
      const { diag, DiagConsoleLogger, DiagLogLevel } = await import(
        "@opentelemetry/api"
      );

      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);

      const serviceName = process.env.OTEL_SERVICE_NAME ?? "northstar-server";
      const sdk = new NodeSDK({
        serviceName,
        traceExporter: new OTLPTraceExporter({ url: traceEndpoint() }),
        instrumentations: [
          ...getNodeAutoInstrumentations({
            "@opentelemetry/instrumentation-fs": { enabled: false },
          }),
          new ExpressInstrumentation(),
        ],
      });

      await sdk.start();
      console.info("[tracing] OpenTelemetry started", {
        serviceName,
        endpoint: traceEndpoint(),
      });

      process.once("SIGTERM", () => {
        sdk.shutdown().catch(() => {});
      });
      process.once("SIGINT", () => {
        sdk.shutdown().catch(() => {});
      });
    } catch (err) {
      globalThis.__northstarOtelStarted = false;
      console.warn("[tracing] OpenTelemetry not available - tracing disabled", err);
    }
  })();
}
