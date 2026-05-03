import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Request, Response, NextFunction } from "express";

function loadOrCreateSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  const cacheDir = path.resolve(process.cwd(), ".local");
  const cacheFile = path.join(cacheDir, ".jwt-secret");

  try {
    if (fs.existsSync(cacheFile)) {
      const cached = fs.readFileSync(cacheFile, "utf-8").trim();
      if (cached.length >= 32) {
        if (process.env.NODE_ENV !== "test") {
          console.warn(
            "[auth-jwt] JWT_SECRET non impostato — uso secret persistente da .local/.jwt-secret. Imposta JWT_SECRET in produzione.",
          );
        }
        return cached;
      }
    }
  } catch {
    /* ignore */
  }

  const generated = crypto.randomBytes(48).toString("hex");
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(cacheFile, generated, { mode: 0o600 });
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[auth-jwt] JWT_SECRET non impostato — generato nuovo secret e salvato in .local/.jwt-secret (i token NON saranno invalidati ai prossimi restart).",
      );
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "test") {
      console.error(
        "[auth-jwt] Impossibile salvare il secret persistente (i token verranno invalidati al prossimo restart):",
        err,
      );
    }
  }
  return generated;
}

const JWT_SECRET = loadOrCreateSecret();

const HEADER_B64 = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
  "base64url",
);

const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

interface JwtPayload {
  sub: number;
  iat: number;
  exp: number;
}

export function signToken(userId: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, iat: now, exp: now + TOKEN_TTL_SECONDS } satisfies JwtPayload),
  ).toString("base64url");

  const data = `${HEADER_B64}.${payload}`;
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): { userId: number } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expected = crypto.createHmac("sha256", JWT_SECRET).update(data).digest("base64url");

  const sigBuf = Buffer.from(sig, "base64url");
  const expBuf = Buffer.from(expected, "base64url");
  if (sigBuf.length !== expBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as JwtPayload;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof parsed.sub !== "number") return null;
    return { userId: parsed.sub };
  } catch {
    return null;
  }
}

/** Extracts userId from Bearer token if present and valid. Never rejects. */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const result = verifyToken(auth.slice(7));
    if (result) res.locals.userId = result.userId;
  }
  next();
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Non autorizzato — token mancante" });
    return;
  }

  const token = auth.slice(7);
  const result = verifyToken(token);
  if (!result) {
    res.status(401).json({ error: "Token non valido o scaduto" });
    return;
  }

  res.locals.userId = result.userId;
  next();
}
