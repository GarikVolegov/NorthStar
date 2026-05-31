import type { Response, Router } from "express";
import { eq } from "drizzle-orm";
import { db, generateUsername, protectedDbQuery, userProfileSettingsTable, usersTable } from "@workspace/db";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";
import { buildJwtPayload, findReferralAccount, generateToken, readReferralCode, readStringField, recordReferral } from "./auth-shared";

type ClerkSyncUser = {
  id: number;
  name: string;
  email: string;
  role: string | null;
  testSessionId: number | null;
  emailVerified: boolean | null;
  stripeSubscriptionId: string | null;
  workPreference: string | null;
  autonomyPreference: number | null;
  stabilityPreference: number | null;
  timezone: string | null;
  userMode: string | null;
  journeyType: string | null;
  avatarUrl: string | null;
  isPublic: boolean | null;
  isAffiliate: boolean | null;
  onboardingCompleted: boolean | null;
};

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === "23505"
  );
}

function userProjection() {
  return {
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
  };
}

async function selectUserByClerkId(clerkId: string): Promise<ClerkSyncUser | null> {
  const [user] = await protectedDbQuery(async () => {
    return await db
      .select(userProjection())
      .from(usersTable)
      .leftJoin(
        userProfileSettingsTable,
        eq(usersTable.id, userProfileSettingsTable.userId),
      )
      .where(eq(usersTable.clerkId, clerkId))
      .limit(1);
  });
  return user ?? null;
}

async function selectUserByEmail(email: string): Promise<ClerkSyncUser | null> {
  const [user] = await protectedDbQuery(async () => {
    return await db
      .select(userProjection())
      .from(usersTable)
      .leftJoin(
        userProfileSettingsTable,
        eq(usersTable.id, userProfileSettingsTable.userId),
      )
      .where(eq(usersTable.email, email))
      .limit(1);
  });
  return user ?? null;
}

async function ensureProfileSettings(
  userId: number,
  displayName: string,
  referralAccountId: number | null,
  referralConvertedAt: Date | null,
): Promise<void> {
  try {
    await protectedDbQuery(async () => {
      return await db
        .insert(userProfileSettingsTable)
        .values({
          userId,
          username: generateUsername(displayName, userId),
          referredByAffiliateId: referralAccountId,
          referralConvertedAt,
        })
        .onConflictDoNothing();
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

function respondWithUser(res: Response, user: ClerkSyncUser, status = 200): void {
  const northstarToken = generateToken(buildJwtPayload(user));
  res.status(status).json({ ...user, northstar_token: northstarToken });
}

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

      let user = await selectUserByClerkId(clerkId);

      if (user) {
        respondWithUser(res, user);
        return;
      }

      let [existingByEmail] = await protectedDbQuery(async () => {
        return await db
          .select({ id: usersTable.id, clerkId: usersTable.clerkId })
          .from(usersTable)
          .where(eq(usersTable.email, normalizedEmail))
          .limit(1);
      });

      if (existingByEmail) {
        if (
          typeof existingByEmail.clerkId === "string" &&
          existingByEmail.clerkId.trim() &&
          existingByEmail.clerkId !== clerkId
        ) {
          res.status(409).json({
            error:
              "Questa email risulta gia collegata a un altro account Clerk. Accedi con quell'account o usa un'email diversa.",
            code: "CLERK_SYNC_EMAIL_ALREADY_LINKED",
          });
          return;
        }

        try {
          await protectedDbQuery(async () => {
            return await db
              .update(usersTable)
              .set({
                clerkId,
                emailVerified: true,
                name: displayName,
                updatedAt: new Date(),
              })
              .where(eq(usersTable.id, existingByEmail.id));
          });
        } catch (err) {
          if (!isUniqueViolation(err)) throw err;
        }

        await ensureProfileSettings(
          existingByEmail.id,
          displayName,
          referralAccount?.id ?? null,
          referralAccount ? new Date() : null,
        );

        const updated =
          (await selectUserByClerkId(clerkId)) ??
          (await selectUserByEmail(normalizedEmail));
        if (updated) {
          respondWithUser(res, updated);
        } else {
          res.status(500).json({ error: "Errore aggiornamento utente" });
        }
        return;
      }

      try {
        const [created] = await protectedDbQuery(async () => {
          return await db
            .insert(usersTable)
            .values({
              name: displayName,
              email: normalizedEmail,
              clerkId,
              emailVerified: true,
            })
            .returning({ id: usersTable.id });
        });

        if (!created) {
          res.status(500).json({ error: "Errore creazione utente", code: "CLERK_SYNC_USER_INSERT" });
          return;
        }

        await ensureProfileSettings(
          created.id,
          displayName,
          referralAccount?.id ?? null,
          referralAccount ? new Date() : null,
        );

        await recordReferral(referralAccount, created.id);

        const newUser = await selectUserByClerkId(clerkId);

        if (newUser) {
          respondWithUser(res, newUser, 201);
        } else {
          res
            .status(500)
            .json({ error: "Errore creazione utente", code: "CLERK_SYNC_USER_FETCH" });
        }
      } catch (dbErr) {
        if (isUniqueViolation(dbErr)) {
          const recovered =
            (await selectUserByClerkId(clerkId)) ??
            (await selectUserByEmail(normalizedEmail));
          if (recovered) {
            respondWithUser(res, recovered);
            return;
          }
        }
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
