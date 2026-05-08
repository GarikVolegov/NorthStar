/**
 * jwt.ts — Middleware JWT riutilizzabile per l’Express server NorthStar.
 *
 * SUPPORTO TOKEN:
 *   1. Authorization: Bearer <token>  (API calls, fetch con header)
 *   2. Cookie 'ns_token'              (SSR / navigazione browser)
 *
 * PAYLOAD ATTESO:
 *   { sub: string (userId), email: string, role?: string }
 *
 *   Attacca req.user = { id: number, email: string, role: string }
 *
 * ALGORITMO:
 *   Produzione (NODE_ENV=production): RS256, usa JWT_PUBLIC_KEY (PEM)
 *   Sviluppo:                         HS256, usa JWT_SECRET
 *
 * USO:
 *   import { requireAuth, optionalAuth } from "../middleware/jwt";
 *
 *   router.get("/protected", requireAuth, handler);
 *   router.get("/optional",  optionalAuth, handler);  // req.user potrebbe essere undefined
 */
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Estendi Express Request
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; role: string };
    }
  }
}

function getSecret(): string | Buffer {
  if (process.env.NODE_ENV === "production") {
    const pub = process.env.JWT_PUBLIC_KEY;
    if (!pub) throw new Error("JWT_PUBLIC_KEY env var mancante in produzione");
    return Buffer.from(pub.replace(/\\n/g, "\n"));
  }
  return process.env.JWT_SECRET ?? "northstar-dev-secret-change-me";
}

function getAlgorithms(): jwt.Algorithm[] {
  return process.env.NODE_ENV === "production" ? ["RS256"] : ["HS256", "RS256"];
}

function extractToken(req: Request): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }
  // 2. Cookie ns_token
  const cookieToken = req.cookies?.ns_token;
  if (typeof cookieToken === "string" && cookieToken.length > 0) {
    return cookieToken;
  }
  return null;
}

function parsePayload(payload: jwt.JwtPayload): { id: number; email: string; role: string } | null {
  const id = Number(payload.sub ?? payload.id);
  if (!id || isNaN(id)) return null;
  return {
    id,
    email: typeof payload.email === "string" ? payload.email : "",
    role:  typeof payload.role  === "string" ? payload.role  : "user",
  };
}

/**
 * requireAuth: blocca la request con 401 se il token è assente/invalido.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Token mancante" });
    return;
  }
  try {
    const payload = jwt.verify(token, getSecret(), {
      algorithms: getAlgorithms(),
    }) as jwt.JwtPayload;
    const user = parsePayload(payload);
    if (!user) { res.status(401).json({ error: "Token payload non valido" }); return; }
    req.user = user;
    next();
  } catch (err) {
    const msg = err instanceof jwt.TokenExpiredError ? "Token scaduto" :
                err instanceof jwt.JsonWebTokenError  ? "Token non valido" :
                "Errore autenticazione";
    res.status(401).json({ error: msg });
  }
}

/**
 * optionalAuth: tenta di leggere il token ma non blocca se assente.
 * req.user sarà undefined per le richieste non autenticate.
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, getSecret(), {
        algorithms: getAlgorithms(),
      }) as jwt.JwtPayload;
      const user = parsePayload(payload);
      if (user) req.user = user;
    } catch { /* token invalido: procedi senza utente */ }
  }
  next();
}
