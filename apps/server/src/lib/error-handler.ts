import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { rootLogger } from "../middleware/logger";
import { captureServerException } from "../sentry";
import { executionMonitor } from "./execution-monitor";
import { isPersistenceSchemaError } from "./persistence";

/**
 * Handler di errore globale di Express (API_RULES §7.1).
 *
 * Mappa gli errori NOTI su status corretti PRIMA del 500 generico:
 * - ZodError              → 400 (validazione fallita). Prima 17 dei 24 `.parse()`
 *                            non gestiti localmente cadevano nel 500 generico.
 * - PG 23505 (unique)     → 409 (risorsa già esistente).
 * - PG 23503 (FK)         → 400 (riferimento non valido).
 * - schema drift          → 503 (persistenza non disponibile / migration mancanti).
 * - tutto il resto        → 500 + log + cattura Sentry/executionMonitor.
 *
 * I 4xx client/validazione NON vengono inviati a Sentry (non sono errori server,
 * eviterebbero solo rumore). È additivo: le route che già gestiscono questi casi
 * non sono toccate.
 */
export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "Dati non validi",
      details: err.flatten().fieldErrors,
    });
    return;
  }

  const pgCode = (err as { code?: unknown })?.code;
  if (pgCode === "23505") {
    res.status(409).json({ error: "Risorsa già esistente" });
    return;
  }
  if (pgCode === "23503") {
    res.status(400).json({ error: "Riferimento non valido" });
    return;
  }

  if (isPersistenceSchemaError(err)) {
    (req.log ?? rootLogger).warn?.(
      { err, persistenceUnavailable: true, setupAction: "run_migrations" },
      "persistence schema error",
    );
    res.status(503).json({
      error: "Persistenza non disponibile: esegui le migration",
      persistenceUnavailable: true,
      setupAction: "run_migrations",
    });
    return;
  }

  // Errore inatteso → log + cattura + 500.
  (req.log ?? rootLogger).error({ err }, "unhandled error");
  captureServerException(err, {
    method: req.method,
    path: req.originalUrl ?? req.url,
    requestId: req.requestId,
    userId: req.user?.id,
  });
  try {
    executionMonitor.capture(err, {
      file: "app.ts",
      function: `${req.method} ${req.originalUrl ?? req.url ?? "<unknown>"}`,
    });
  } catch {
    /* fire-and-forget */
  }
  res.status(500).json({
    error: "Internal Server Error",
    message: "Something went wrong",
  });
}
