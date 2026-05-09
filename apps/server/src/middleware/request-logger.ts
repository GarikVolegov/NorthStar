/**
 * request-logger.ts — Middleware Express per log strutturati con requestId.
 *
 * COSA FA:
 *   1. Genera un requestId univoco per ogni richiesta HTTP:
 *        - Preferisce X-Request-Id se presente nell'header della richiesta
 *          (utile quando un API gateway/load balancer lo propaga)
 *        - Altrimenti genera crypto.randomUUID() (nativo Node.js 14.17+)
 *   2. Aggiunge requestId a:
 *        - req.id          (standard pino-http)
 *        - res header X-Request-Id (tracciabile dal frontend/curl)
 *   3. Inietta req.log: child logger con { requestId } come campo fisso
 *        Ogni log fatto tramite req.log porta automaticamente il requestId.
 *   4. Logga la richiesta in ingresso (debug) e la risposta in uscita (info)
 *        con metodo, url, status, durata in ms.
 *
 * USO nei router/handler:
 *   import type { RequestWithLog } from "../middleware/request-logger";
 *
 *   router.get("/me", (req: RequestWithLog, res) => {
 *     req.log.info({ userId: req.user.id }, "fetch profilo");
 *     // → { requestId: "abc-123", userId: 42, msg: "fetch profilo", ... }
 *   });
 *
 * MONTAGGIO in index.ts (DOPO helmet/cors, PRIMA delle route):
 *   import { requestLogger } from "./middleware/request-logger";
 *   app.use(requestLogger);
 */
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import { childLogger, type Logger } from "../lib/logger";

// Estende Request con req.log e req.id
export interface RequestWithLog extends Request {
  id:  string;
  log: Logger;
}

// Header da cui leggere il requestId propagato (es. da API gateway)
const REQUEST_ID_HEADER = "x-request-id";

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // 1. Determina o genera il requestId
  const requestId =
    (req.headers[REQUEST_ID_HEADER] as string | undefined)?.trim()
    || randomUUID();

  // 2. Attacca requestId alla request e all'header di risposta
  (req as RequestWithLog).id  = requestId;
  res.setHeader("X-Request-Id", requestId);

  // 3. Child logger con requestId fisso — tutti i log da req.log
  //    avranno automaticamente { requestId } nel payload JSON
  const reqLog = childLogger({ requestId });
  (req as RequestWithLog).log = reqLog;

  // 4. Log ingresso (debug: non inquina info in prod, utile in dev)
  reqLog.debug(
    { method: req.method, url: req.originalUrl, ip: req.ip },
    "→ request",
  );

  // 5. Log uscita: intercetta res.end per catturare status e timing
  const startAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startAt) / 1e6;
    const level = res.statusCode >= 500 ? "error"
                : res.statusCode >= 400 ? "warn"
                : "info";

    reqLog[level](
      {
        method:     req.method,
        url:        req.originalUrl,
        status:     res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        userId:     (req as RequestWithLog & { user?: { id: number } }).user?.id,
      },
      "← response",
    );
  });

  next();
}
