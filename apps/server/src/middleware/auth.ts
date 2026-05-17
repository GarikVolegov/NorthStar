import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
const { verify } = jwt;
import { rootLogger } from "./logger";
import { db, usersTable, userProfileSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";
if (!JWT_SECRET) {
  rootLogger.fatal("[auth] JWT_SECRET not configured — cannot authenticate");
  process.exit(1);
}

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY ?? "";
const CLERK_JWKS_URL = process.env.CLERK_JWKS_URL ?? "https://api.clerk.com/v1/jwks";

interface ClerkJwtPayload {
  sub: string;
  email?: string;
  name?: string;
  userId?: number;
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

let jwksCache: { keys: Array<{ kid: string; n: string; e: string }> } | null = null;
let jwksCacheTime = 0;

async function getClerkJwks() {
  const now = Date.now();
  if (jwksCache && now - jwksCacheTime < 3600000) {
    return jwksCache;
  }
  const res = await fetch(CLERK_JWKS_URL);
  jwksCache = await res.json();
  jwksCacheTime = now;
  return jwksCache;
}

async function verifyClerkToken(token: string): Promise<ClerkJwtPayload | null> {
  try {
    if (!CLERK_SECRET_KEY) return null;

    const jwks = await getClerkJwks();
    if (!jwks) return null;

    const header = JSON.parse(Buffer.from(token.split(".")[0], "base64").toString());
    const key = jwks.keys.find((k) => k.kid === header.kid);
    if (!key) return null;

    const n = Buffer.from(key.n, "base64");
    const e = Buffer.from(key.e, "base64");

    const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.concat([
      Buffer.from([0x30]),
      Buffer.from([0x82, (n.length + e.length + 4) >> 8, (n.length + e.length + 4) & 0xff]),
      Buffer.from([0x02, n.length + 1, 0x00, ...n]),
      Buffer.from([0x02, e.length, ...e]),
    ]).toString("base64").match(/.{1,64}/g)!.join("\n")}\n-----END PUBLIC KEY-----`;

    const payload = verify(token, pem, { algorithms: ["RS256"] }) as ClerkJwtPayload;
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
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
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
    // Fallback: prova a verificare come Clerk JWT
    const clerkPayload = await verifyClerkToken(token);
    if (clerkPayload?.sub) {
      // Cerca l'utente nel DB tramite clerkId (sub)
      try {
        const [dbUser] = await db
          .select({
            id:                   usersTable.id,
            name:                 usersTable.name,
            email:                usersTable.email,
            role:                 usersTable.role,
            stripeSubscriptionId: usersTable.stripeSubscriptionId,
            journeyType:          usersTable.journeyType,
            testSessionId:        usersTable.testSessionId,
            onboardingCompleted:  usersTable.onboardingCompleted,
          })
          .from(usersTable)
          .where(eq(usersTable.clerkId, clerkPayload.sub))
          .limit(1);

        if (dbUser) {
          req.user = {
            id:                   dbUser.id,
            name:                 dbUser.name,
            email:                dbUser.email,
            role:                 (dbUser.role as "user" | "admin") ?? "user",
            stripeSubscriptionId: dbUser.stripeSubscriptionId,
            journeyType:          dbUser.journeyType,
            testSessionId:        dbUser.testSessionId,
            onboardingCompleted:  dbUser.onboardingCompleted ?? false,
          };

          if (req.log) req.log = req.log.child({ userId: dbUser.id });
          next();
          return;
        }

        // Utente Clerk non in DB → auto-upsert (evita 401 per nuovi utenti o utenti pre-migrazione)
        // Estrae email e nome dai claim del token Clerk (se presenti) o usa fallback
        const rawPayload = clerkPayload as unknown as Record<string, unknown>;
        const clerkEmail = rawPayload.email as string | undefined;
        const clerkName  = (rawPayload.name as string | undefined)
          ?? (rawPayload.username as string | undefined)
          ?? "Utente";
        const clerkSub = clerkPayload.sub;

        if (clerkEmail) {
          try {
            // Cerca per email per collegare account pre-esistenti
            const [existingByEmail] = await db
              .select({ id: usersTable.id })
              .from(usersTable)
              .where(eq(usersTable.email, clerkEmail.toLowerCase()))
              .limit(1);

            let userId: number;

            if (existingByEmail) {
              // Collega clerkId all'account esistente
              await db.update(usersTable)
                .set({ clerkId: clerkSub, emailVerified: true, updatedAt: new Date() })
                .where(eq(usersTable.id, existingByEmail.id));
              userId = existingByEmail.id;
            } else {
              // Crea nuovo utente
              const [newUser] = await db.insert(usersTable)
                .values({
                  clerkId:       clerkSub,
                  email:         clerkEmail.toLowerCase(),
                  name:          clerkName,
                  emailVerified: true,
                  role:          "user",
                  passwordHash:  "",
                })
                .returning({ id: usersTable.id });
              userId = newUser.id;
            }

            req.user = {
              id:                   userId,
              name:                 clerkName,
              email:                clerkEmail,
              role:                 "user",
              stripeSubscriptionId: null,
              journeyType:          null,
              testSessionId:        null,
              onboardingCompleted:  false,
            };

            if (req.log) req.log = req.log.child({ userId });
            next();
            return;
          } catch (upsertErr) {
            rootLogger.warn({ upsertErr, clerkSub }, "[auth] auto-upsert Clerk user failed");
          }
        }

        rootLogger.warn({ clerkId: clerkSub }, "[auth] Clerk user not synced, no email in token");
      } catch (dbErr) {
        rootLogger.warn({ dbErr }, "[auth] DB lookup/upsert for Clerk user failed");
      }
    }

    if (req.log) {
      req.log.error({ err: "auth_failed" }, "JWT verification failed");
    }
    res.status(401).json({ error: "Token non valido" });
  }
}

export async function requirePremium(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user?.stripeSubscriptionId) {
    res.status(403).json({ code: "PREMIUM_REQUIRED", error: "Funzione riservata agli abbonati Pro" });
    return;
  }
  next();
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user?.role !== "admin") {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  next();
}

/**
 * optionalAuth — tries to authenticate via Bearer token but never blocks.
 * Sets req.user if a valid token is present, otherwise leaves it undefined.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
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
    const clerkPayload = await verifyClerkToken(token);
    if (clerkPayload && clerkPayload.userId) {
      req.user = {
        id: clerkPayload.userId,
        name: clerkPayload.name ?? "",
        email: clerkPayload.email ?? "",
        role: "user",
        stripeSubscriptionId: null,
        journeyType: null,
        testSessionId: null,
        onboardingCompleted: false,
      };

      if (req.log) {
        req.log = req.log.child({ userId: clerkPayload.userId });
      }
    }
  }

  next();
}