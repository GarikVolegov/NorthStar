import { Router } from "express";
import crypto from "node:crypto";
import * as QRCode from "qrcode";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  affiliateAccountsTable,
  affiliateCommissionsTable,
  affiliateReferralsTable,
  affiliateWithdrawalsTable,
  db,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

function affiliateReserveCents(): number {
  const value = Number(process.env.AFFILIATE_RESERVE_CENTS ?? "900");
  return Number.isInteger(value) && value > 0 ? value : 900;
}

function minWithdrawCents(): number {
  const explicitCents = Number(process.env.AFFILIATE_MIN_WITHDRAWAL_CENTS);
  if (Number.isInteger(explicitCents) && explicitCents > 0) return explicitCents;

  const explicitEur = Number(process.env.AFFILIATE_MIN_WITHDRAWAL_EUR);
  if (Number.isFinite(explicitEur) && explicitEur > 0) return Math.round(explicitEur * 100);

  return affiliateReserveCents();
}

function publicAppUrl(): string {
  const value =
    process.env.PUBLIC_APP_URL ??
    process.env.CLIENT_URL ??
    process.env.FRONTEND_URL ??
    process.env.APP_URL ??
    "http://localhost:5173";
  return value.replace(/\/+$/, "");
}

function buildReferralLink(code: string): string {
  return `${publicAppUrl()}/sign-up?ref=${encodeURIComponent(code)}`;
}

function buildQrCodeUrl(): string {
  return "/api/affiliate/qr";
}

function normalizeReferralCode(seed: string, userId: number): string {
  const base = seed
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase()
    .slice(0, 10);
  return `${base || "NS"}${userId}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
}

async function ensureAffiliateAccount(userId: number) {
  const [existing] = await db
    .select()
    .from(affiliateAccountsTable)
    .where(and(eq(affiliateAccountsTable.userId, userId), isNull(affiliateAccountsTable.deletedAt)))
    .limit(1);

  if (existing) {
    if (existing.status === "suspended") {
      return { error: "Account affiliazione sospeso" as const, account: null };
    }
    return { error: null, account: existing };
  }

  const [user] = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!user) {
    return { error: "Utente non trovato" as const, account: null };
  }

  const referralCode = normalizeReferralCode(user.name || user.email, user.id);
  const [created] = await db
    .insert(affiliateAccountsTable)
    .values({
      userId,
      referralCode,
      status: "active",
      updatedAt: new Date(),
    })
    .returning();

  return { error: null, account: created };
}

router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { error, account } = await ensureAffiliateAccount(userId);

    if (error || !account) {
      res.status(error === "Utente non trovato" ? 404 : 403).json({
        error: error ?? "Programma affiliazione non disponibile",
      });
      return;
    }

    const referralRows = await db
      .select({
        id: affiliateReferralsTable.id,
        referredUserId: affiliateReferralsTable.referredUserId,
        status: affiliateReferralsTable.status,
        activatedAt: affiliateReferralsTable.activatedAt,
        cancelledAt: affiliateReferralsTable.cancelledAt,
        referredUserName: usersTable.name,
        referredUserEmail: usersTable.email,
      })
      .from(affiliateReferralsTable)
      .leftJoin(usersTable, eq(affiliateReferralsTable.referredUserId, usersTable.id))
      .where(eq(affiliateReferralsTable.affiliateId, account.id))
      .orderBy(desc(affiliateReferralsTable.activatedAt));

    const commissionRows = await db
      .select({
        referredUserId: affiliateCommissionsTable.referredUserId,
        amountCents: affiliateCommissionsTable.amountCents,
        status: affiliateCommissionsTable.status,
        appliedAt: affiliateCommissionsTable.appliedAt,
      })
      .from(affiliateCommissionsTable)
      .where(eq(affiliateCommissionsTable.affiliateId, account.id));

    const commissionByUser = new Map<number, { amount: number; paidAt: Date | null }>();
    for (const commission of commissionRows) {
      if (commission.status === "void") continue;
      const current = commissionByUser.get(commission.referredUserId) ?? { amount: 0, paidAt: null };
      current.amount += commission.amountCents ?? 0;
      if (commission.appliedAt && (!current.paidAt || commission.appliedAt > current.paidAt)) {
        current.paidAt = commission.appliedAt;
      }
      commissionByUser.set(commission.referredUserId, current);
    }

    const referrals = referralRows.map((referral) => {
      const commission = commissionByUser.get(referral.referredUserId);
      return {
        id: String(referral.id),
        referredUserName: referral.referredUserName ?? "Utente NorthStar",
        referredUserEmail: referral.referredUserEmail ?? "",
        status: referral.status === "cancelled" ? "cancelled" : "confirmed",
        commissionAmount: commission?.amount ?? 0,
        createdAt: referral.activatedAt.toISOString(),
        paidAt: commission?.paidAt?.toISOString() ?? null,
        cancelledAt: referral.cancelledAt?.toISOString() ?? null,
      };
    });

    res.json({
      balance: account.withdrawableBalance,
      pendingBalance: account.lockedBalance,
      lockedBalance: account.lockedBalance,
      withdrawableBalance: account.withdrawableBalance,
      totalEarned: account.totalEarned,
      totalReferrals: account.totalReferrals,
      referralCode: account.referralCode,
      referralLink: buildReferralLink(account.referralCode),
      qrCodeUrl: buildQrCodeUrl(),
      referrals,
      subscription: {
        plan: account.isPremiumActive ? "premium" : "free",
        status: account.status,
        currentPeriodEnd: account.nextRenewalAt?.toISOString() ?? null,
      },
      minWithdrawAmount: minWithdrawCents(),
      rule: {
        lockedReserveCents: affiliateReserveCents(),
        description: "Le commissioni coprono prima una soglia pari a un mese Premium; il resto diventa ritirabile.",
      },
    });
  } catch (err) {
    req.log?.error?.({ err }, "affiliate dashboard error");
    res.status(500).json({ error: "Errore caricamento dashboard affiliazione" });
  }
});

router.get("/qr", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { error, account } = await ensureAffiliateAccount(userId);

    if (error || !account) {
      res.status(error === "Utente non trovato" ? 404 : 403).json({
        error: error ?? "Programma affiliazione non disponibile",
      });
      return;
    }

    const referralLink = buildReferralLink(account.referralCode);
    const qrSvg = await QRCode.toString(referralLink, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    });
    const safeReferralLink = referralLink.replace(/--/g, "%2D%2D");
    const svg = `<!-- referralLink: ${safeReferralLink} -->\n${qrSvg}`;

    const disposition = req.query.download === "1"
      ? `attachment; filename="northstar-referral-${account.referralCode}.svg"`
      : `inline; filename="northstar-referral-${account.referralCode}.svg"`;

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader("Content-Disposition", disposition);
    res.send(svg);
  } catch (err) {
    req.log?.error?.({ err }, "affiliate qr error");
    res.status(500).json({ error: "Errore generazione QR referral" });
  }
});

router.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const rawAmount = Number(req.body?.amount);
    const method = req.body?.method === "bank_transfer" ? "bank_transfer" : "paypal";
    const destination = typeof req.body?.destination === "string" ? req.body.destination.trim() : null;

    if (!Number.isInteger(rawAmount) || rawAmount <= 0) {
      res.status(400).json({ error: "Importo non valido" });
      return;
    }

    const minimum = minWithdrawCents();
    if (rawAmount < minimum) {
      res.status(400).json({ error: "Importo minimo prelievo non raggiunto", minWithdrawAmount: minimum });
      return;
    }

    const { error, account } = await ensureAffiliateAccount(userId);
    if (error || !account) {
      res.status(error === "Utente non trovato" ? 404 : 403).json({
        error: error ?? "Programma affiliazione non disponibile",
      });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [fresh] = await tx
        .select()
        .from(affiliateAccountsTable)
        .where(eq(affiliateAccountsTable.id, account.id))
        .limit(1);

      if (!fresh || fresh.status === "suspended") {
        throw Object.assign(new Error("Account affiliazione non disponibile"), { statusCode: 403 });
      }

      if (fresh.withdrawableBalance < rawAmount) {
        throw Object.assign(new Error("Saldo ritirabile insufficiente"), { statusCode: 400 });
      }

      const [withdrawal] = await tx
        .insert(affiliateWithdrawalsTable)
        .values({
          affiliateId: fresh.id,
          amountCents: rawAmount,
          method,
          destination,
          status: "pending",
          updatedAt: new Date(),
        })
        .returning();

      await tx
        .update(affiliateAccountsTable)
        .set({
          withdrawableBalance: sql`${affiliateAccountsTable.withdrawableBalance} - ${rawAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(affiliateAccountsTable.id, fresh.id));

      return withdrawal;
    });

    res.status(201).json({
      ok: true,
      withdrawal: {
        id: result.id,
        amountCents: result.amountCents,
        method: result.method,
        status: result.status,
        createdAt: result.createdAt.toISOString(),
      },
    });
  } catch (err) {
    const statusCode = (err as { statusCode?: number })?.statusCode ?? 500;
    req.log?.error?.({ err }, "affiliate withdraw error");
    res.status(statusCode).json({
      error: err instanceof Error ? err.message : "Errore richiesta prelievo",
    });
  }
});

export default router;
