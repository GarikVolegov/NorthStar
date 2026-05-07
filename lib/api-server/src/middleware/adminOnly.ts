/**
 * adminOnly middleware
 * ────────────────
 * Protects admin routes with a shared secret.
 * The caller must send the header:
 *
 *   x-admin-secret: <value of ADMIN_SECRET env var>
 *
 * WHY NOT role-based JWT?
 * The existing JWT payload only carries { sub, email } — no role field.
 * Adding a role would require a token migration.
 * A separate admin secret is simpler, safer for a single-operator setup,
 * and can be rotated independently of user tokens.
 *
 * USAGE:
 *   import { adminOnly } from "../middleware/adminOnly";
 *   router.post("/my-route", adminOnly, handler);
 *
 * ENV:
 *   ADMIN_SECRET=<random 32+ char string>   (required)
 */
import { Request, Response, NextFunction } from "express";

export function adminOnly(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) {
    // Fail open-only in dev without the var; hard-block in production.
    if (process.env.NODE_ENV === "production") {
      res.status(500).json({ error: "ADMIN_SECRET not configured" });
      return;
    }
    console.warn("[adminOnly] ADMIN_SECRET not set — allowing request in non-production env");
    next();
    return;
  }

  const provided = req.headers["x-admin-secret"];
  if (!provided || provided !== secret) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  next();
}
