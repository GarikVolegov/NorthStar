let tracer: any = null;

const noopSpan = {
  end() {},
  setAttribute() {},
  setStatus() {},
  recordException() {},
  isRecording() { return false; },
};

const noopTracer = {
  startSpan() { return noopSpan; },
};

export async function initTracing(serviceName: string = "ai-server"): Promise<void> {
  if (tracer) return;
  try {
    const { trace } = await import("@opentelemetry/api");
    tracer = trace.getTracer(serviceName);
  } catch {
    tracer = noopTracer;
  }
}

export function startSpan(name: string, attributes?: Record<string, string | number | boolean | undefined>): { end(): void; setAttribute(key: string, value: string | number | boolean): void; setStatus(status: { code: number; message?: string }): void; recordException(err: unknown): void } {
  if (!tracer) {
    tracer = noopTracer;
  }
  const span = tracer.startSpan(name);
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value != null) {
        try { span.setAttribute(key, value); } catch {}
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
    (result) => { span.end(); return result; },
    (err) => {
      try { span.recordException(err); } catch {}
      try { span.setStatus({ code: 2, message: String(err) }); } catch {}
      span.end();
      throw err;
    },
  );
}
