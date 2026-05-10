/**
 * Logging middleware — assigns a unique X-Request-Id to every request
 * and creates a child pino logger scoped to that request.
 *
 * Must be mounted BEFORE jwtMiddleware and all route handlers:
 *   app.use(requestIdMiddleware);
 *   app.use(loggingMiddleware);
 *
 * Usage in route handlers:
 *   (req as any).log.info({ userId }, 'message');
 *   (req as any).log.error({ err }, 'something failed');
 */
import { Request, Response, NextFunction } from "express";
import pino from "pino";

// Root logger — singleton shared across the whole api-server process.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // Pretty-print in dev; pure JSON in production (stdout).
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
  base: { service: "api-server" },
});

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Prefer the ID already set by express-request-id, then any incoming
  // X-Request-Id header (propagation from another service), then generate one.
  const requestId: string =
    (req as any).id ??
    (req.headers["x-request-id"] as string | undefined) ??
    crypto.randomUUID();

  // Child logger: every log line produced through req.log automatically
  // carries requestId, method and path — no manual spreading required.
  (req as any).log = logger.child({
    requestId,
    method: req.method,
    path: req.path,
  });

  // Expose the ID on the response so the frontend can read it from headers.
  res.setHeader("X-Request-Id", requestId);

  (req as any).log.info("request started");

  res.on("finish", () => {
    (req as any).log.info({ statusCode: res.statusCode }, "request completed");
  });

  next();
}
