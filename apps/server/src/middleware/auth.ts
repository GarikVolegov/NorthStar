import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
const { verify } = jwt;
import { rootLogger } from "./logger";

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
  } catch (err) {
    if (req.log) {
      req.log.error({ err }, "JWT verification failed");
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
    // Invalid token — silently ignore, user stays unauthenticated
  }

  next();
}