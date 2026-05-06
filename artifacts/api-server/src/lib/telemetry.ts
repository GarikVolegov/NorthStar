/**
 * OpenTelemetry instrumentation for the NorthStar API server.
 * Gracefully disabled when OpenTelemetry packages are not installed
 * or when OTEL_EXPORTER_OTLP_ENDPOINT is not set.
 */

const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (!endpoint) {
  console.warn(
    "[telemetry] OTEL_EXPORTER_OTLP_ENDPOINT not set — distributed tracing disabled."
  );
} else {
  try {
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await import("@opentelemetry/auto-instrumentations-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
    const { Resource } = await import("@opentelemetry/resources");
    const { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } = await import("@opentelemetry/semantic-conventions");

    const serviceName = process.env.OTEL_SERVICE_NAME ?? "northstar-api";

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
          "@opentelemetry/instrumentation-fs": { enabled: false },
        }),
      ],
    });

    sdk.start();

    process.on("SIGTERM", () => {
      sdk.shutdown().catch((err) => console.error("[telemetry] shutdown error", err));
    });

    console.info(`[telemetry] OpenTelemetry started — service=${serviceName} endpoint=${endpoint}`);
  } catch (err) {
    console.warn("[telemetry] OpenTelemetry packages not available — tracing disabled.", err);
  }
}
