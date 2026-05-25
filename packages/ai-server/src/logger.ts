import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino/file",
          options: { destination: 1 },
        },
      }
    : {}),
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
  userId?: number | string | undefined;
  sessionId?: number | string | undefined;
  domain?: string;
  intent?: string;
  routeConfidence?: number;
  supervisorScore?: number;
  requestId?: string | undefined;
  traceId?: string;
};
