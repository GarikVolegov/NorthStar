/**
 * public-profile-router.ts — GET /api/u/:username
 *
 * Endpoint pubblico (no auth). Risponde solo se isPublic = true.
 * MAI espone: email, passwordHash, cvText, cvJson, stripeId, resetToken,
 * verificationCode o qualsiasi dato sensibile.
 *
 * Include RIASEC dalla testSession più recente se presente.
 * Include referralCode dall'affiliateAccountsTable se presente.
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  testSessionsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

// Import affiliateAccountsTable if available
let affiliateAccountsTable: any = null;
try {
  // Graceful: se la tabella non esiste ancora nel DB non crasha
  const mod = require("@workspace/db");
  affiliateAccountsTable = mod.affiliateAccountsTable ?? null;
} catch { /* tabella non ancora in scope */ }

export const publicProfileRouter = Router();

publicProfileRouter.get("/u/:username", async (req: Request, res: Response) => {
  const { username } = req.params;
  if (!username || username.length > 80) {
    res.status(400).json({ error: "Username non valido" }); return;
  }

  try {
    // ─ 1. Fetch user (solo campi pubblici sicuri) ──────────────────────
    const user = await db
      .select({
        id:          usersTable.id,
        name:        usersTable.name,
        username:    usersTable.username,
        avatarUrl:   usersTable.avatarUrl,
        isPublic:    usersTable.isPublic,
        journeyType: usersTable.journeyType,
        totalXp:     usersTable.totalXp,
        streakDays:  usersTable.streakDays,
        voiceStreak: usersTable.voiceStreak,
        createdAt:   usersTable.createdAt,
      })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!user || !user.isPublic) {
      res.status(404).json({ error: "Profilo non trovato" }); return;
    }

    // ─ 2. Level from XP ────────────────────────────────────────
    const totalXp = user.totalXp ?? 0;
    const level   = Math.floor(totalXp / 500);

    // ─ 3. RIASEC from last test session ───────────────────────────
    const session = await db
      .select({
        riasecScores:    testSessionsTable.riasecScores,
        primaryTypes:    testSessionsTable.primaryTypes,
        profileSummary:  testSessionsTable.profileSummary,
        recommendations: testSessionsTable.recommendations,
      })
      .from(testSessionsTable)
      .where(eq(testSessionsTable.userId, user.id))
      .orderBy(desc(testSessionsTable.createdAt))
      .limit(1)
      .then((r) => r[0] ?? null);

    const riasec = session && Object.keys(session.riasecScores ?? {}).length > 0
      ? {
          primaryTypes:    session.primaryTypes,
          riasecScores:    session.riasecScores,
          profileSummary:  session.profileSummary,
          recommendations: (session.recommendations ?? []).map((r: any) => ({
            sectorName: r.sectorName,
            matchScore: r.matchScore,
          })),
        }
      : null;

    // ─ 4. Referral code (se affiliato) ───────────────────────────
    let referralCode: string | null = null;
    if (affiliateAccountsTable) {
      try {
        const aff = await db
          .select({ referralCode: affiliateAccountsTable.referralCode })
          .from(affiliateAccountsTable)
          .where(eq(affiliateAccountsTable.userId, user.id))
          .limit(1)
          .then((r: any[]) => r[0] ?? null);
        referralCode = aff?.referralCode ?? null;
      } catch { /* affiliateAccounts non ancora presente */ }
    }

    // ─ 5. Risposta ───────────────────────────────────────────
    res.json({
      name:         user.name,
      username:     user.username,
      avatarUrl:    user.avatarUrl,
      journeyType:  user.journeyType,
      totalXp,
      level,
      streakDays:   user.streakDays  ?? 0,
      voiceStreak:  user.voiceStreak ?? 0,
      memberSince:  user.createdAt,
      referralCode,
      riasec,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});
