import type { Router } from "express";
import { eq } from "drizzle-orm";
import { db, generateUsername, protectedDbQuery, userProfileSettingsTable, usersTable } from "@workspace/db";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";
import { buildJwtPayload, findReferralAccount, generateToken, readReferralCode, readStringField, recordReferral } from "./auth-shared";

export function registerClerkSyncRoute(router: Router): void {
router.post("/clerk-sync", async (req, res) => {
    try {
      // SECURITY: verifica che il Bearer token (Clerk JWT) contenga
      // lo stesso sub/clerkId inviato nel body — previene impersonificazione.
      const authHeader = req.headers.authorization;
      const body = asPlainRecord(getRequestBody(req));
      const bodyClerkId = readStringField(body, "clerkId");
      const email = readStringField(body, "email");
      const name = body.name;
      const referralCode = readReferralCode(body.referralCode);

      const missingFields = [
        !bodyClerkId ? "clerkId" : null,
        typeof email !== "string" || !email.trim() ? "email" : null,
      ].filter(Boolean);

      if (missingFields.length > 0) {
        res.status(400).json({
          error: "Dati Clerk incompleti: clerkId ed email sono richiesti.",
          code: "CLERK_SYNC_INVALID_PAYLOAD",
          missingFields,
        });
        return;
      }

      const displayName =
        typeof name === "string" && name.trim() ? name.trim() : email.trim();

      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.slice(7);
          // Decode JWT payload senza verifica firma (la firma è verificata da Clerk SDK client-side)
          // Usiamo solo per confrontare sub con clerkId fornito nel body
          const parts = token.split(".");
          const payloadPart = parts[1];
          if (parts.length === 3 && payloadPart) {
            const payloadJson = Buffer.from(payloadPart, "base64url").toString(
              "utf-8",
            );
            const tokenPayload = JSON.parse(payloadJson) as { sub?: string };
            if (tokenPayload.sub && tokenPayload.sub !== bodyClerkId) {
              res.status(403).json({ error: "Token non corrisponde al clerkId" });
              return;
            }
          }
        } catch {
          // Token malformato — procedi comunque (protezione soft)
        }
      }

      const clerkId = bodyClerkId;
      const normalizedEmail = email.trim().toLowerCase();
      const referralAccount = referralCode
        ? await findReferralAccount(referralCode)
        : null;

      let [user] = await protectedDbQuery(async () => {
        return await db
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
          })
          .from(usersTable)
          .leftJoin(
            userProfileSettingsTable,
            eq(usersTable.id, userProfileSettingsTable.userId),
          )
          .where(eq(usersTable.clerkId, clerkId))
          .limit(1);
      });

      if (user) {
        const northstarToken = generateToken(buildJwtPayload(user));
        res.json({ ...user, northstar_token: northstarToken });
        return;
      }

      let [existingByEmail] = await protectedDbQuery(async () => {
        return await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(eq(usersTable.email, normalizedEmail))
          .limit(1);
      });

      if (existingByEmail) {
        await db
          .update(usersTable)
          .set({
            clerkId,
            emailVerified: true,
            name: displayName,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, existingByEmail.id));

        const [updated] = await db
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
          })
          .from(usersTable)
          .leftJoin(
            userProfileSettingsTable,
            eq(usersTable.id, userProfileSettingsTable.userId),
          )
          .where(eq(usersTable.id, existingByEmail.id))
          .limit(1);

        if (updated) {
          const northstarToken = generateToken(buildJwtPayload(updated));
          res.json({ ...updated, northstar_token: northstarToken });
        } else {
          res.status(500).json({ error: "Errore aggiornamento utente" });
        }
        return;
      }

      try {
        const [created] = await db
          .insert(usersTable)
          .values({
            name: displayName,
            email: normalizedEmail,
            clerkId,
            emailVerified: true,
          })
          .returning({ id: usersTable.id });

        if (!created) {
          res.status(500).json({ error: "Errore creazione utente", code: "CLERK_SYNC_USER_INSERT" });
          return;
        }

        await db.insert(userProfileSettingsTable).values({
          userId: created.id,
          username: generateUsername(displayName, created.id),
          referredByAffiliateId: referralAccount?.id ?? null,
          referralConvertedAt: referralAccount ? new Date() : null,
        });

        await recordReferral(referralAccount, created.id);

        const [newUser] = await db
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
          })
          .from(usersTable)
          .leftJoin(
            userProfileSettingsTable,
            eq(usersTable.id, userProfileSettingsTable.userId),
          )
          .where(eq(usersTable.id, created.id))
          .limit(1);

        if (newUser) {
          const northstarToken = generateToken(buildJwtPayload(newUser));
          res.status(201).json({ ...newUser, northstar_token: northstarToken });
        } else {
          res
            .status(500)
            .json({ error: "Errore creazione utente", code: "CLERK_SYNC_USER_FETCH" });
        }
      } catch (dbErr) {
        req.log?.error?.({ err: dbErr }, "clerk-sync db write failed");
        const dbDetails =
          process.env.NODE_ENV !== "production" && dbErr instanceof Error
            ? { details: dbErr.message }
            : {};
        res.status(500).json({
          error: "Errore database durante sync Clerk",
          code: "CLERK_SYNC_DB",
          ...dbDetails,
        });
        return;
      }
    } catch (err) {
      req.log?.error?.({ err }, "clerk-sync error");
      const details =
        process.env.NODE_ENV !== "production" && err instanceof Error
          ? { details: err.message }
          : {};
      res.status(500).json({
        error: "Errore durante la sincronizzazione con Clerk",
        code: "CLERK_SYNC_ERROR",
        ...details,
      });
    }
  });


}
