import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
const { verify } = jwt;
import { rootLogger } from "./logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getEffectivePlan, planMeets } from "./check-feature";
import { JWT_SECRET } from "../lib/jwt-secret";
import { logSecurityEvent } from "../lib/security-events";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        name: string;
        email: string;
        role: "user" | "admin";
        stripeSubscriptionId: string | null;
        journeyType: string | null;
        testSessionId: number | null;
        onboardingCompleted: boolean;
      };
    }
  }
}

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";
const CLERK_JWKS_URL =
  process.env.CLERK_JWKS_URL ?? "https://api.clerk.com/v1/jwks";
// Issuer della nostra istanza Clerk. Senza questo, il fallback Clerk è disattivo:
// pinnare `iss` evita di accettare token firmati da un'ALTRA istanza/tenant.
const CLERK_ISSUER = process.env.CLERK_ISSUER ?? "";

interface ClerkJwtPayload {
  sub: string;
  email?: string;
  name?: string;
}

/** Dati utente risolti dal DB (path Clerk), forma stabile come il JWT NorthStar. */
type ResolvedDbUser = {
  id: number;
  name: string;
  email: string;
  role: string | null;
  stripeSubscriptionId: string | null;
  journeyType: string | null;
  testSessionId: number | null;
  onboardingCompleted: boolean | null;
};

function toReqUser(dbUser: ResolvedDbUser): NonNullable<Request["user"]> {
  return {
    id: dbUser.id,
    name: dbUser.name,
    email: dbUser.email,
    role: (dbUser.role as "user" | "admin") ?? "user",
    stripeSubscriptionId: dbUser.stripeSubscriptionId,
    journeyType: dbUser.journeyType,
    testSessionId: dbUser.testSessionId,
    onboardingCompleted: dbUser.onboardingCompleted ?? false,
  };
}

/**
 * Risolve l'utente locale a partire dal `sub` Clerk (mappato su `users.clerkId`).
 * SICUREZZA: l'identità deriva SOLO dal `sub` di un token verificato, mai da
 * claim `userId`/`email` arbitrari. Nessun auto-provisioning/linking-by-email
 * (era un vettore di account takeover): un account si crea via /register o
 * /google-token, non dentro un middleware di lettura.
 */
async function resolveClerkUserBySub(
  sub: string,
): Promise<ResolvedDbUser | null> {
  const [dbUser] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      stripeSubscriptionId: usersTable.stripeSubscriptionId,
      journeyType: usersTable.journeyType,
      testSessionId: usersTable.testSessionId,
      onboardingCompleted: usersTable.onboardingCompleted,
    })
    .from(usersTable)
    .where(eq(usersTable.clerkId, sub))
    .limit(1);
  return dbUser ?? null;
}

/** Shape of the stable user data embedded in every JWT at login/register time */
interface JwtPayload {
  userId: number;
  name: string;
  email: string;
  role: "user" | "admin";
  onboardingCompleted: boolean;
  journeyType: string | null;
  stripeSubscriptionId: string | null;
  testSessionId: number | null;
}

let jwksCache: { keys: Array<{ kid: string; n: string; e: string }> } | null =
  null;
let jwksCacheTime = 0;

async function getClerkJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCacheTime < 3600000) {
    return jwksCache;
  }
  const res = await fetch(CLERK_JWKS_URL);
  jwksCache = (await res.json()) as { keys: Array<{ kid: string; n: string; e: string }> };
  jwksCacheTime = now;
  return jwksCache;
}

async function verifyClerkToken(
  token: string,
): Promise<ClerkJwtPayload | null> {
  try {
    // Fail-closed: il fallback Clerk opera solo se l'istanza è pienamente
    // configurata (secret key + issuer pinnato).
    if (!CLERK_SECRET_KEY || !CLERK_ISSUER) return null;

    const jwks = await getClerkJwks();
    if (!jwks) return null;

    const tokenHeader = token.split(".")[0];
    if (!tokenHeader) return null;
    const header = JSON.parse(Buffer.from(tokenHeader, "base64").toString()) as { kid?: string };
    const key = jwks.keys.find((k) => k.kid === header.kid);
    if (!key) return null;

    const n = Buffer.from(key.n, "base64");
    const e = Buffer.from(key.e, "base64");

    const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.concat([
      Buffer.from([0x30]),
      Buffer.from([
        0x82,
        (n.length + e.length + 4) >> 8,
        (n.length + e.length + 4) & 0xff,
      ]),
      Buffer.from([0x02, n.length + 1, 0x00, ...n]),
      Buffer.from([0x02, e.length, ...e]),
    ])
      .toString("base64")
      .match(/.{1,64}/g)!
      .join("\n")}\n-----END PUBLIC KEY-----`;

    const payload = verify(token, pem, {
      algorithms: ["RS256"],
      issuer: CLERK_ISSUER,
    }) as ClerkJwtPayload;
    return payload;
  } catch {
    return null;
  }
}

/**
 * requireAuth — 0 DB queries.
 *
 * Stable user data (id, role, onboardingCompleted, journeyType,
 * stripeSubscriptionId, testSessionId) is embedded in the JWT at
 * login/register time and extracted here without hitting the database.
 *
 * Only the `/me` endpoint makes a DB query for full profile data that
 * changes frequently (preferences, avatar, timezone, etc.).
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token mancante" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verify(token, JWT_SECRET) as unknown as JwtPayload;

    req.user = {
      id: payload.userId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      stripeSubscriptionId: payload.stripeSubscriptionId,
      journeyType: payload.journeyType,
      testSessionId: payload.testSessionId,
      onboardingCompleted: payload.onboardingCompleted,
    };

    if (req.log) {
      req.log = req.log.child({ userId: payload.userId });
    }

    next();
  } catch {
    // Fallback: verifica come Clerk JWT e risolvi l'utente SOLO tramite sub.
    const clerkPayload = await verifyClerkToken(token);
    if (clerkPayload?.sub) {
      try {
        const dbUser = await resolveClerkUserBySub(clerkPayload.sub);
        if (dbUser) {
          req.user = toReqUser(dbUser);
          if (req.log) req.log = req.log.child({ userId: dbUser.id });
          next();
          return;
        }
        rootLogger.warn(
          { clerkId: clerkPayload.sub },
          "[auth] Clerk token valido ma nessun utente collegato (clerkId non in DB)",
        );
      } catch (dbErr) {
        rootLogger.warn({ dbErr }, "[auth] lookup utente Clerk fallito");
      }
    }

    if (req.log) {
      req.log.error({ err: "auth_failed" }, "JWT verification failed");
    }
    logSecurityEvent("auth_failed", { ip: req.ip, detail: "jwt_verification_failed" });
    res.status(401).json({ error: "Token non valido" });
  }
}

export async function requirePremium(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const currentPlan = await getEffectivePlan(req.user.id);
  if (!planMeets(currentPlan, "pro")) {
    res
      .status(403)
      .json({
        code: "PREMIUM_REQUIRED",
        error: "Funzione riservata agli abbonati Pro",
      });
    return;
  }
  next();
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [dbUser] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, req.user.id))
      .limit(1);

    if (dbUser?.role !== "admin") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    req.user.role = "admin";
    logSecurityEvent("admin_access", { userId: req.user.id, ip: req.ip });
    next();
  } catch (err) {
    rootLogger.error(
      { err, userId: req.user.id },
      "[auth] admin role check failed",
    );
    res.status(500).json({ error: "Errore verifica permessi admin" });
  }
}

export async function requireAdminAccess(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, async () => {
    await requireAdmin(req, res, next);
  });
}

export async function requireAdminToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  await requireAdmin(req, res, next);
}

/**
 * optionalAuth — tries to authenticate via Bearer token but never blocks.
 * Sets req.user if a valid token is present, otherwise leaves it undefined.
 */
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    next();
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verify(token, JWT_SECRET) as unknown as JwtPayload;

    req.user = {
      id: payload.userId,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      stripeSubscriptionId: payload.stripeSubscriptionId,
      journeyType: payload.journeyType,
      testSessionId: payload.testSessionId,
      onboardingCompleted: payload.onboardingCompleted,
    };

    if (req.log) {
      req.log = req.log.child({ userId: payload.userId });
    }
  } catch {
    // SICUREZZA: risolvi l'identità SOLO dal sub di un token Clerk verificato
    // (mai dal claim numerico `userId` fornito dal client). Se non risolve,
    // si prosegue come anonimi (optionalAuth non blocca mai).
    const clerkPayload = await verifyClerkToken(token);
    if (clerkPayload?.sub) {
      try {
        const dbUser = await resolveClerkUserBySub(clerkPayload.sub);
        if (dbUser) {
          req.user = toReqUser(dbUser);
          if (req.log) req.log = req.log.child({ userId: dbUser.id });
        }
      } catch (dbErr) {
        rootLogger.warn({ dbErr }, "[auth] optionalAuth lookup Clerk fallito");
      }
    }
  }

  next();
}
