import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
const { verify } = jwt;
import { pool } from "@workspace/db";
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

interface TokenPayload {
  userId: number;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token mancante" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verify(token, JWT_SECRET) as unknown as TokenPayload;

    const { rows } = await pool.query<{
      id: number; name: string; email: string;
      stripe_subscription_id: string | null;
      test_session_id: number | null;
    }>(
      `SELECT id, name, email, stripe_subscription_id, test_session_id
       FROM users WHERE id = $1 LIMIT 1`,
      [payload.userId],
    );

    const user = rows[0];
    if (!user) {
      res.status(401).json({ error: "Utente non trovato" });
      return;
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: "user",
      stripeSubscriptionId: user.stripe_subscription_id,
      journeyType: null,
      testSessionId: user.test_session_id,
      onboardingCompleted: true,
    };

    if (req.log) {
      req.log = req.log.child({ userId: user.id });
    }

    next();
  } catch {
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
