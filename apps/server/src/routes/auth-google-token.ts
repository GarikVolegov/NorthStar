import type { Router } from "express";
import { eq, or } from "drizzle-orm";
import { db, generateUsername, protectedDbQuery, userProfileSettingsTable, usersTable } from "@workspace/db";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";
import { verifyGoogleIdToken } from "../lib/google-auth";
import { authLimiter } from "../middleware/rate-limit";
import { buildJwtPayload, generateToken, readStringField } from "./auth-shared";

export function registerGoogleTokenRoute(router: Router): void {
router.post("/google-token", authLimiter, async (req, res) => {
    try {
      const body = asPlainRecord(getRequestBody(req));
      const credential = readStringField(body, "credential");
      if (!credential) {
        res.status(400).json({ error: "Credential richiesto" });
        return;
      }

      // SICUREZZA: verifica crittografica del token (firma + aud + iss).
      // Non ci si fida MAI del payload base64 grezzo: era un takeover di account.
      const identity = await verifyGoogleIdToken(credential);
      if (!identity) {
        res.status(401).json({ error: "Token Google non valido" });
        return;
      }
      if (!identity.emailVerified) {
        res.status(403).json({ error: "Email Google non verificata" });
        return;
      }

      const googleId = identity.sub;
      const email = identity.email;
      const name = identity.name;
      const avatarUrl = identity.picture;

      let [existing] = await protectedDbQuery(async () => {
        return await db
          .select()
          .from(usersTable)
          .where(
            or(eq(usersTable.googleId, googleId), eq(usersTable.email, email)),
          )
          .limit(1);
      });

      if (existing) {
        if (!existing.googleId) {
          await protectedDbQuery(async () => {
            return await db
              .update(usersTable)
              .set({
                googleId,
                emailVerified: true,
                avatarUrl: avatarUrl ?? existing.avatarUrl,
                updatedAt: new Date(),
              })
              .where(eq(usersTable.id, existing.id));
          });
        }
      } else {
        const [created] = await protectedDbQuery(async () => {
          return await db
            .insert(usersTable)
            .values({
              name,
              email,
              googleId,
              avatarUrl,
              emailVerified: true,
            })
            .returning({ id: usersTable.id });
        });

        if (!created) {
          throw new Error("Utente Google non creato");
        }

        await db.insert(userProfileSettingsTable).values({
          userId: created.id,
          username: generateUsername(name, created.id),
        });
      }

      const [user] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          testSessionId: usersTable.testSessionId,
          emailVerified: usersTable.emailVerified,
          stripeSubscriptionId: usersTable.stripeSubscriptionId,
          workPreference: userProfileSettingsTable.workPreference,
          autonomyPreference: userProfileSettingsTable.autonomyPreference,
          stabilityPreference: userProfileSettingsTable.stabilityPreference,
          timezone: userProfileSettingsTable.timezone,
          userMode: userProfileSettingsTable.userMode,
          journeyType: usersTable.journeyType,
          avatarUrl: usersTable.avatarUrl,
          isPublic: userProfileSettingsTable.isPublic,
          isAffiliate: userProfileSettingsTable.isAffiliate,
          onboardingCompleted: usersTable.onboardingCompleted,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .leftJoin(
          userProfileSettingsTable,
          eq(usersTable.id, userProfileSettingsTable.userId),
        )
        .where(eq(usersTable.email, email))
        .limit(1);

      if (!user) {
        res.status(500).json({ error: "Errore durante l'accesso con Google" });
        return;
      }

      const token = generateToken(buildJwtPayload(user));

      res.json({
        ...user,
        token,
      });
    } catch (err) {
      req.log?.error?.({ err }, "google-token error");
      res.status(500).json({ error: "Errore durante l'accesso con Google" });
    }
  });

  /* ─── POST /api/auth/refresh  —  refresh token ───────────────────── */

}
