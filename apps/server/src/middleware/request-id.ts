import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

export function requestIdMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const id = (req.headers["x-request-id"] as string) ?? randomUUID();
  req.requestId = id;
  _res.setHeader("x-request-id", id);
  next();
}
