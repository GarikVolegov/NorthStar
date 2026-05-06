/**
 * Centralized admin key middleware.
 * Import this in any admin route instead of duplicating the check.
 *
 * Usage:
 *   import { adminKeyMiddleware } from "../lib/admin-middleware.js";
 *   router.use("/admin", adminKeyMiddleware);
 */
import type { Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "node:crypto";

export function adminKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    res.status(503).json({ error: "Admin non configurato." });
    return;
  }

  const provided = req.headers["x-admin-key"];
  if (typeof provided !== "string") {
    res.status(403).json({ error: "Accesso non autorizzato." });
    return;
  }

  // FIX: use timing-safe comparison to prevent timing attacks on the admin key
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(adminKey).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(403).json({ error: "Accesso non autorizzato." });
    return;
  }

  next();
}
