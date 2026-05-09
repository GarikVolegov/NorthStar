/**
 * GET /api/auth/me
 *
 * API_RULES.md: endpoint autenticato, risposta senza campi sensibili.
 * Ritorna il profilo aggiornato dell'utente loggato, incluso isAffiliate.
 * Usato da AuthContext.tsx al mount per sincronizzare i dati freschi
 * dal DB (es. dopo che un admin ha impostato isAffiliate = true).
 *
 * Autenticazione: JWT via jwtMiddleware (applicato sul router).
 * Rate limit: apiLimiter (eredita dal mount in app.ts).
 */
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { jwtMiddleware } from "../middleware/jwt";

const router = Router();

// Applica JWT su tutto il router (mount su /api/auth non è coperto dal
// jwtMiddleware globale di app.ts che parte da /api ma esclude /api/auth)
router.use(jwtMiddleware);

/**
 * GET /api/auth/me
 * Risposta: AuthUser (stesso shape di AuthContext.AuthUser)
 */
router.get("/me", async (req: Request, res: Response): Promise<void> => {
  const userId = (req as any).user?.id as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [user] = await db
      .select({
        id:                    usersTable.id,
        name:                  usersTable.name,
        email:                 usersTable.email,
        avatarUrl:             usersTable.avatarUrl,
        testSessionId:         usersTable.testSessionId,
        emailVerified:         usersTable.emailVerified,
        stripeSubscriptionId:  usersTable.stripeSubscriptionId,
        workPreference:        usersTable.workPreference,
        autonomyPreference:    usersTable.autonomyPreference,
        stabilityPreference:   usersTable.stabilityPreference,
        timezone:              usersTable.timezone,
        userMode:              usersTable.userMode,
        journeyType:           usersTable.journeyType,
        isPublic:              usersTable.isPublic,
        // Fase 4: isAffiliate — permette alla navbar di mostrare il link
        isAffiliate:           usersTable.isAffiliate,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Nessun campo sensibile (passwordHash, verificationCode, resetToken)
    // è incluso nella select — sicuro per risposta pubblica autenticata.
    res.json(user);
  } catch (err) {
    console.error("[auth/me]", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
