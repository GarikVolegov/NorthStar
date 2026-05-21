type SpanStatus = { code: number; message?: string };

type SpanLike = {
  end(): void;
  setAttribute(key: string, value: string | number | boolean): void;
  setStatus(status: SpanStatus): void;
  recordException(err: unknown): void;
  isRecording?(): boolean;
};

type TracerLike = {
  startSpan(name: string): SpanLike;
};

type InstrumentationModule = {
  registerInstrumentations(options: { instrumentations: unknown[] }): void;
};

type AutoInstrumentationsModule = {
  getNodeAutoInstrumentations(options?: Record<string, unknown>): unknown;
};

function optionalImport<T>(specifier: string): Promise<T> {
  return import(specifier) as Promise<T>;
}

let tracer: TracerLike | null = null;
let autoInstrumentationsRegistered = false;

const noopSpan: SpanLike = {
  end() {},
  setAttribute(_key: string, _value: string | number | boolean) {},
  setStatus(_status: SpanStatus) {},
  recordException(_err: unknown) {},
  isRecording() { return false; },
};

const noopTracer: TracerLike = {
  startSpan(_name: string) { return noopSpan; },
};

export async function initTracing(serviceName: string = "ai-server"): Promise<void> {
  if (tracer) return;
  try {
    const { trace } = await import("@opentelemetry/api");
    if (!autoInstrumentationsRegistered && process.env.OTEL_AUTO_INSTRUMENTATIONS !== "false") {
      try {
        const [instrumentationModule, autoInstrumentationModule] = await Promise.all([
          optionalImport<InstrumentationModule>("@opentelemetry/instrumentation"),
          optionalImport<AutoInstrumentationsModule>("@opentelemetry/auto-instrumentations-node"),
        ]);
        instrumentationModule.registerInstrumentations({
          instrumentations: [
            autoInstrumentationModule.getNodeAutoInstrumentations({
              "@opentelemetry/instrumentation-fs": { enabled: false },
            }),
          ],
        });
        autoInstrumentationsRegistered = true;
      } catch {
        autoInstrumentationsRegistered = false;
      }
    }
    tracer = trace.getTracer(serviceName) as TracerLike;
  } catch {
    tracer = noopTracer;
  }
}

export function startSpan(
  name: string,
  attributes?: Record<string, string | number | boolean | undefined>,
): SpanLike {
  if (!tracer) {
    tracer = noopTracer;
  }
  const span = tracer.startSpan(name);
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value != null) {
        try {
          span.setAttribute(key, value);
        } catch {
          void 0;
        }
      }
    }
  }
  return span;
}

export function withActiveSpan<T>(
  name: string,
  fn: () => Promise<T>,
  attributes?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const span = startSpan(name, attributes);
  return fn().then(
    (result) => {
      span.end();
      return result;
    },
    (err: unknown) => {
      try {
        span.recordException(err);
      } catch {
        void 0;
      }
      try {
        span.setStatus({ code: 2, message: String(err) });
      } catch {
        void 0;
      }
      span.end();
      throw err;
    },
  );
}
