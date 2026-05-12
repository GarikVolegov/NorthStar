import { type Request, type Response, type NextFunction } from "express";
import { verify } from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";

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
  console.error("[auth] JWT_SECRET not configured — cannot authenticate");
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

    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        stripeSubscriptionId: usersTable.stripeSubscriptionId,
        journeyType: usersTable.journeyType,
        testSessionId: usersTable.testSessionId,
        onboardingCompleted: usersTable.onboardingCompleted,
      })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Utente non trovato" });
      return;
    }

    req.user = {
      ...user,
      role: "user" as const,
    };

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
