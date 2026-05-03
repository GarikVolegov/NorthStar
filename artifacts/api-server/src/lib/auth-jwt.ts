import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET =
  process.env.JWT_SECRET ??
  (() => {
    const s = crypto.randomBytes(32).toString("hex");
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[auth-jwt] JWT_SECRET not set — generated an ephemeral secret. Tokens will be invalidated on restart.",
      );
    }
    return s;
  })();

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
