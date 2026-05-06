/**
 * Security headers middleware.
 * Apply this globally in the Express app setup (before routes).
 *
 * Usage:
 *   import { securityHeaders } from "./lib/security-headers.js";
 *   app.use(securityHeaders);
 */
import type { Request, Response, NextFunction } from "express";

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  // Prevent MIME-type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // Enforce HTTPS for 1 year (only in production)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  // Restrict referrer info leakage
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Block dangerous browser features
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()"
  );

  // Basic Content Security Policy
  // Tighten this once you know your exact CDN/font sources
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",  // tighten to nonce-based in future
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  // Remove server fingerprint
  res.removeHeader("X-Powered-By");

  next();
}
