import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  name: "ws-server",
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  transport: isDev
    ? { target: "pino/file", options: { destination: 1 } }
    : undefined,
  formatters: {
    level(label) { return { level: label }; },
  },
  redact: {
    paths: ["token", "JWT_SECRET", "authorization"],
    censor: "[REDACTED]",
  },
});
