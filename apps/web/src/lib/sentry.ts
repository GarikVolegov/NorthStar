import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const environment =
  (import.meta.env.VITE_SENTRY_ENVIRONMENT as string | undefined) ??
  (import.meta.env.MODE as string | undefined) ??
  "development";
const release =
  (import.meta.env.VITE_SENTRY_RELEASE as string | undefined) ??
  (import.meta.env.VITE_COMMIT_SHA as string | undefined) ??
  "development";

let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
  });

  initialized = true;
  return true;
}

export function captureClientException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized && !initSentry()) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext("client", context);
    Sentry.captureException(error);
  });
}

export function captureClientMessage(
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!initialized && !initSentry()) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext("client", context);
    Sentry.captureMessage(message);
  });
}

initSentry();
