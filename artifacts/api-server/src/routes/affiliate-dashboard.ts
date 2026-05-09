/**
 * GET /api/affiliate/dashboard
 *
 * Dashboard dati per affiliati attivi (isAffiliate=true).
 * Richiede JWT auth + isAffiliate flag.
 *
 * Risposta:
 *   - account: saldo, commissioni totali, referral count
 *   - referrals: lista referral confermati con stato
 *   - commissions: ultime 20 commissioni
 *   - withdrawals: storico prelievi
 *   - referralLink: link condivisibile
 */
import { Router } from "express";
import {
  db,
  usersTable,
  affiliateAccountsTable,
  affiliateReferralsTable,
  affiliateCommissionsTable,
  affiliateWithdrawalsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";
import { z } from "zod";

const router = Router();

const COMMISSION_PCT = Number(process.env.AFFILIATE_COMMISSION_PCT ?? 20);
const MIN_WITHDRAWAL_CENTS = Math.round(
  Number(process.env.AFFILIATE_MIN_WITHDRAWAL_EUR ?? 10) * 100,
);

function getAppBaseUrl(): string {
  const replitDomains = process.env.REPLIT_DOMAINS;
  const replitDomain = replitDomains ? replitDomains.split(",")[0].trim() : null;
  const raw =
    process.env.APP_BASE_URL ??
    process.env.PUBLIC_APP_URL ??
    (replitDomain ? `https://${replitDomain}` : null) ??
    (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null) ??
    "https://northstar.app";
  return raw.startsWith("http") ? raw.replace(/\/$/, "") : `https://${raw}`;
}

router.get("/affiliate/dashboard", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;

  const [user] = await db
    .select({ id: usersTable.id, isAffiliate: usersTable.isAffiliate })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  if (!user.isAffiliate) {
    res.status(403).json({
      error: "AFFILIATE_REQUIRED",
      message: "Accesso riservato agli affiliati NorthStar.",
    });
    return;
  }

  const [account] = await db
    .select()
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.userId, userId));

  if (!account) {
    res.status(404).json({ error: "Account affiliato non trovato. Contatta il supporto." });
    return;
  }

  const referrals = await db
    .select({
      id: affiliateReferralsTable.id,
      referredUserId: affiliateReferralsTable.referredUserId,
      status: affiliateReferralsTable.status,
      convertedAt: affiliateReferralsTable.convertedAt,
      createdAt: affiliateReferralsTable.createdAt,
    })
    .from(affiliateReferralsTable)
    .where(eq(affiliateReferralsTable.affiliateId, account.id))
    .orderBy(desc(affiliateReferralsTable.createdAt));

  const commissions = await db
    .select()
    .from(affiliateCommissionsTable)
    .where(eq(affiliateCommissionsTable.affiliateId, account.id))
    .orderBy(desc(affiliateCommissionsTable.createdAt))
    .limit(20);

  const withdrawals = await db
    .select()
    .from(affiliateWithdrawalsTable)
    .where(eq(affiliateWithdrawalsTable.affiliateId, account.id))
    .orderBy(desc(affiliateWithdrawalsTable.createdAt))
    .limit(10);

  const referralLink = `${getAppBaseUrl()}/register?ref=${account.referralCode}`;

  res.json({
    account: {
      id: account.id,
      referralCode: account.referralCode,
      referralLink,
      status: account.status,
      isPremiumActive: account.isPremiumActive,
      lockedBalanceCents: account.lockedBalance,
      withdrawableBalanceCents: account.withdrawableBalance,
      totalEarnedCents: account.totalEarned,
      totalReferrals: account.totalReferrals,
      minWithdrawalCents: MIN_WITHDRAWAL_CENTS,
      commissionPct: COMMISSION_PCT,
      nextRenewalAt: account.nextRenewalAt?.toISOString() ?? null,
      createdAt: account.createdAt.toISOString(),
    },
    referrals: referrals.map((r) => ({
      id: r.id,
      referredUserId: r.referredUserId,
      status: r.status,
      convertedAt: r.convertedAt?.toISOString() ?? null,
      createdAt: r.createdAt?.toISOString() ?? null,
    })),
    commissions: commissions.map((c) => ({
      id: c.id,
      amountCents: c.amountCents,
      month: c.month,
      status: c.status,
      appliedTo: c.appliedTo,
      createdAt: c.createdAt.toISOString(),
    })),
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      amountCents: w.amountCents,
      method: w.method,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
      paidAt: w.paidAt?.toISOString() ?? null,
    })),
  });
});

const WithdrawBody = z.object({
  method: z.enum(["paypal", "bank_transfer"]),
  destination: z.string().min(3).max(200),
});

router.post("/affiliate/withdraw", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;

  const parsed = WithdrawBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.flatten() });
    return;
  }

  const [user] = await db
    .select({ isAffiliate: usersTable.isAffiliate })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user?.isAffiliate) {
    res.status(403).json({ error: "AFFILIATE_REQUIRED" });
    return;
  }

  const [account] = await db
    .select()
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.userId, userId));

  if (!account) {
    res.status(404).json({ error: "Account affiliato non trovato" });
    return;
  }

  if (account.status === "suspended") {
    res.status(403).json({ error: "Account sospeso. Contatta il supporto." });
    return;
  }

  if (account.withdrawableBalance < MIN_WITHDRAWAL_CENTS) {
    res.status(400).json({
      error: "Saldo insufficiente per il prelievo",
      minimumCents: MIN_WITHDRAWAL_CENTS,
      currentCents: account.withdrawableBalance,
    });
    return;
  }

  const amountCents = account.withdrawableBalance;

  const [withdrawal] = await db
    .insert(affiliateWithdrawalsTable)
    .values({
      affiliateId: account.id,
      amountCents,
      method: parsed.data.method,
      destination: parsed.data.destination,
      status: "pending",
    })
    .returning();

  await db
    .update(affiliateAccountsTable)
    .set({ withdrawableBalance: 0, updatedAt: new Date() })
    .where(eq(affiliateAccountsTable.id, account.id));

  res.status(201).json({
    ok: true,
    withdrawalId: withdrawal.id,
    amountCents,
    method: parsed.data.method,
    status: "pending",
    message: "Richiesta di prelievo creata. Verrà elaborata entro 3-5 giorni lavorativi.",
  });
});

export default router;
