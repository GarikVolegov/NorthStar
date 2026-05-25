import type { Request } from "express";

type RequestLogger = {
  error?: (payload: unknown, message?: string) => void;
  warn?: (payload: unknown, message?: string) => void;
  info?: (payload: unknown, message?: string) => void;
  debug?: (payload: unknown, message?: string) => void;
};

export function getRequestUser(req: Request) {
  return req.user ?? null;
}

export function getRequestLogger(req: Request): RequestLogger {
  const maybeLogger = (req as Request & { log?: RequestLogger }).log;
  return maybeLogger ?? {};
}

export function getRequestBody(req: Request): unknown {
  return (req as Request & { body?: unknown }).body;
}
