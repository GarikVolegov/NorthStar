import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  transport: isDev
    ? {
        target: "pino/file",
        options: { destination: 1 },
      }
    : undefined,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
  redact: {
    paths: ["apiKey", "api_key", "OPENAI_API_KEY", "JWT_SECRET", "password", "token"],
    censor: "[REDACTED]",
  },
});

export type LoggerFields = {
  userId?: number | string;
  sessionId?: number | string;
  domain?: string;
  intent?: string;
  routeConfidence?: number;
  supervisorScore?: number;
  requestId?: string;
  traceId?: string;
};
