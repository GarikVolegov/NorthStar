import type { Request, Response } from "express";
import { rootLogger } from "../middleware/logger";

export type SetupAction = "run_migrations" | "check_database" | "check_schema";

const SCHEMA_ERROR_CODES = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "42883", // undefined_function/operator in schema drift queries
  "42P07", // duplicate_table, usually half-applied migration
]);

export function isPersistenceSchemaError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code;
  if (typeof code === "string" && SCHEMA_ERROR_CODES.has(code)) return true;

  const message = String((err as { message?: unknown })?.message ?? err).toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("undefined_table") ||
    message.includes("undefined_column") ||
    message.includes("relation") && message.includes("does not exist") ||
    message.includes("column") && message.includes("does not exist")
  );
}

export function logPersistenceWarning(req: Request, err: unknown, route: string): void {
  const log = req.log ?? rootLogger;
  log.warn?.(
    {
      err,
      route,
      userId: req.user?.id,
      persistenceUnavailable: true,
      setupAction: "run_migrations" satisfies SetupAction,
    },
    "optional persistence unavailable",
  );
}

export function sendOptionalReadFallback<T>(
  req: Request,
  res: Response,
  err: unknown,
  route: string,
  fallback: T,
): boolean {
  if (!isPersistenceSchemaError(err)) return false;
  logPersistenceWarning(req, err, route);
  res.status(200).json(fallback);
  return true;
}

export function sendPersistenceWriteError(
  req: Request,
  res: Response,
  err: unknown,
  route: string,
): boolean {
  if (!isPersistenceSchemaError(err)) return false;
  logPersistenceWarning(req, err, route);
  res.status(503).json({
    error: "Persistenza non disponibile: esegui le migration",
    persistenceUnavailable: true,
    setupAction: "run_migrations" satisfies SetupAction,
  });
  return true;
}
