import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

const rootLogger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  ...(isDev ? { transport: { target: "pino/file", options: { destination: 1 } } } : {}),
  formatters: {
    level(label) { return { level: label }; },
  },
  serializers: { err: pino.stdSerializers.err },
  redact: {
    paths: ["apiKey", "api_key", "OPENAI_API_KEY", "JWT_SECRET", "password", "token"],
    censor: "[REDACTED]",
  },
});

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      log: pino.Logger;
    }
  }
}

export function requestLoggerMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) ?? randomUUID();
  req.requestId = requestId;
  _res.setHeader("x-request-id", requestId);

  req.log = rootLogger.child({ requestId });

  next();
}

export function enrichLoggerWithUser(req: Request, userId: number): void {
  req.log = req.log.child({ userId });
}

export { rootLogger };
