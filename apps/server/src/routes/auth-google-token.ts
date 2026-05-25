import type { Router } from "express";
import { eq, or } from "drizzle-orm";
import { db, generateUsername, protectedDbQuery, userProfileSettingsTable, usersTable } from "@workspace/db";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";
import { buildJwtPayload, generateToken, readStringField } from "./auth-shared";

export function registerGoogleTokenRoute(router: Router): void {
router.post("/google-token", async (req, res) => {
    try {
      const body = asPlainRecord(getRequestBody(req));
      const credential = readStringField(body, "credential");
      if (!credential) {
        res.status(400).json({ error: "Credential richiesto" });
        return;
      }

      const credentialPayload = credential.split(".")[1];
      if (!credentialPayload) {
        res.status(400).json({ error: "Credential non valido" });
        return;
      }
      const googlePayload = JSON.parse(
        Buffer.from(credentialPayload, "base64").toString(),
      ) as {
        sub: string;
        email: string;
        name: string;
        picture?: string;
      };

      const googleId = googlePayload.sub;
      const email = googlePayload.email.toLowerCase();
      const name = googlePayload.name;
      const avatarUrl = googlePayload.picture ?? null;

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
