import { type Request, type Response, type NextFunction } from "express";
import { rootLogger } from "./logger";

/**
 * Middleware to protect /api/metrics endpoint
 * Allows access via Bearer token (METRICS_TOKEN env var) or IP allowlist (ALLOWED_IPS env var)
 */
export function metricsProtection(req: Request, res: Response, next: NextFunction): void {
  const metricsToken = process.env.METRICS_TOKEN;
  const allowedIpsStr = process.env.ALLOWED_IPS ?? "";
  
  // Get client IP (handling proxies)
  const clientIp = req.headers["x-forwarded-for"] 
    ? Array.isArray(req.headers["x-forwarded-for"]) 
      ? req.headers["x-forwarded-for"][0] 
      : req.headers["x-forwarded-for"]
    : req.socket.remoteAddress ?? "";
  
  // Normalize IP (handle ::ffff:127.0.0.1 -> 127.0.0.1)
  const normalizedIp = clientIp.replace(/^::ffff:/, "");

  // Check Bearer token
  if (metricsToken) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      if (token === metricsToken) {
        return next();
      }
    }
  }

  // Check IP allowlist
  if (allowedIpsStr.trim() !== "") {
    const allowedIps = allowedIpsStr
      .split(",")
      .map(ip => ip.trim())
      .filter(ip => ip.length > 0);

    // Check for exact match or CIDR-like match (simple prefix match for now)
    const ipMatches = allowedIps.some(allowedIp => {
      // Handle CIDR notation simply - if it contains "/" treat as prefix match
      if (allowedIp.includes("/")) {
        const prefix = allowedIp.split("/")[0];
        return normalizedIp.startsWith(prefix);
      }
      return normalizedIp === allowedIp;
    });

    if (ipMatches) {
      return next();
    }
  }

  // If neither token nor IP allowlist grants access, deny
  rootLogger.warn({ clientIp: normalizedIp }, "Unauthorized access attempt to /api/metrics");
  res.status(401).json({ error: "Unauthorized" });
}