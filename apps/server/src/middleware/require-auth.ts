import type { RequestHandler } from "express";
import { requireAuth as verifyUser, requireAdmin } from "./auth";

export interface RequireAuthOptions {
  role?: "admin" | "user";
}

export function requireAuth(options: RequireAuthOptions = {}): RequestHandler {
  return async (req, res, next) => {
    await verifyUser(req, res, async () => {
      if (options.role === "admin") {
        await requireAdmin(req, res, next);
        return;
      }
      next();
    });
  };
}
