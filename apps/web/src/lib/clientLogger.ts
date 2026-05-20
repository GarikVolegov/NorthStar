import { captureClientException } from "@/lib/sentry";

type LogFields = Record<string, unknown>;

const isDev = import.meta.env.DEV;

function asError(message: string, fields?: LogFields): Error {
  const err = new Error(message);
  if (fields) {
    Object.assign(err, { fields });
  }
  return err;
}

export const clientLogger = {
  warn(message: string, fields?: LogFields): void {
    if (isDev) {
      console.warn(message, fields);
      return;
    }
    captureClientException(asError(message, fields), {
      level: "warning",
      ...(fields ?? {}),
    });
  },
  error(message: string, error?: unknown, fields?: LogFields): void {
    if (isDev) {
      console.error(message, error, fields);
    }
    captureClientException(
      error instanceof Error ? error : asError(message, fields),
      {
        level: "error",
        message,
        ...(fields ?? {}),
      },
    );
  },
};
