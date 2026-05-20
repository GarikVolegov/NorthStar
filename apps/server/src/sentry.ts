import * as Sentry from "@sentry/node";

import { rootLogger } from "./middleware/logger";

type ServerSentry = Pick<typeof Sentry, "captureException" | "captureMessage">;

declare global {
  var Sentry: ServerSentry | undefined;
}

const dsn = process.env.SENTRY_DSN ?? process.env.SERVER_SENTRY_DSN ?? "";
const environment =
  process.env.SENTRY_ENVIRONMENT ??
  process.env.RAILWAY_ENVIRONMENT ??
  process.env.NODE_ENV ??
  "development";
const release =
  process.env.SENTRY_RELEASE ??
  process.env.RELEASE_VERSION ??
  process.env.GITHUB_SHA ??
  "development";

let initialized = false;

export function initSentry(): boolean {
  if (initialized) return true;

  globalThis.Sentry = Sentry;

  if (!dsn) {
    rootLogger.info("[sentry] DSN not set - server error reporting disabled");
    return false;
  }

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
  });

  initialized = true;
  rootLogger.info({ environment, release }, "[sentry] server initialized");
  return true;
}

export function captureServerException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!initialized && !initSentry()) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext("server", context);
    Sentry.captureException(error);
  });
}

export function captureServerMessage(
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!initialized && !initSentry()) return;
  Sentry.withScope((scope) => {
    if (context) scope.setContext("server", context);
    Sentry.captureMessage(message);
  });
}

initSentry();
