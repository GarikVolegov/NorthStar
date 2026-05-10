/**
 * affiliate-router.ts — Express router per il programma affiliazione.
 *
 * Endpoints:
 *   GET  /api/affiliate/dashboard   → dati completi dashboard
 *   POST /api/affiliate/withdraw    → richiesta prelievo
 *   GET  /api/affiliate/referrals   → lista referral paginata
 *   GET  /api/affiliate/withdrawals → storico prelievi
 *
 *   POST /api/admin/affiliate/commission  → webhook interno (Stripe / cron)
 *
 * Tutti gli endpoint richiedono autenticazione JWT (middleware: requireAuth).
 * L'endpoint admin richiede requireAdmin.
 */
import { Router, type Request, type Response } from "express";
import {
  getDashboardData,
  requestWithdrawal,
  recordMonthlyCommission,
  incrementReferralCount,
  getOrCreateAccount,
  COMMISSION_CENTS,
} from "./affiliate-service";
import { db } from "@workspace/db";
import {
  affiliateCommissionsTable,
  affiliateWithdrawalsTable,
  affiliateAccountsTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

export const affiliateRouter = Router();

// ── Auth helpers (placeholder — sostituisci con il tuo middleware JWT) ─────────
function requireAuth(req: Request, res: Response, next: () => void) {
  const userId = (req as Request & { user?: { id: number } }).user?.id;
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
}
function requireAdmin(req: Request, res: Response, next: () => void) {
  const user = (req as Request & { user?: { id: number; isAdmin?: boolean } }).user;
  if (!user?.isAdmin) { res.status(403).json({ error: "Accesso negato" }); return; }
  next();
}
function userId(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

// ── GET /api/affiliate/dashboard ──────────────────────────────────────────────
affiliateRouter.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const data = await getDashboardData(userId(req));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore interno" });
  }
});

// ── POST /api/affiliate/withdraw ──────────────────────────────────────────────
affiliateRouter.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const { amount, method, destination } = req.body as {
      amount: number;        // in euro (es. 29.00)
      method: "paypal" | "bank_transfer";
      destination?: string;
    };
    if (!amount || !method) {
      res.status(400).json({ error: "amount e method obbligatori" }); return;
    }
    const amountCents = Math.round(amount * 100);
    const account     = await getOrCreateAccount(userId(req));
    const result      = await requestWithdrawal(account.id, amountCents, method, destination);
    res.json({ success: true, withdrawalId: result.withdrawalId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore interno";
    res.status(400).json({ error: msg });
  }
});

// ── GET /api/affiliate/referrals ──────────────────────────────────────────────
affiliateRouter.get("/referrals", requireAuth, async (req, res) => {
  try {
    const account = await getOrCreateAccount(userId(req));
    const page    = Math.max(1, Number(req.query.page ?? 1));
    const limit   = 20;
    const offset  = (page - 1) * limit;

    const rows = await db
      .select()
      .from(affiliateCommissionsTable)
      .where(eq(affiliateCommissionsTable.affiliateId, account.id))
      .orderBy(desc(affiliateCommissionsTable.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ referrals: rows, page, limit });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore interno" });
  }
});

// ── GET /api/affiliate/withdrawals ────────────────────────────────────────────
affiliateRouter.get("/withdrawals", requireAuth, async (req, res) => {
  try {
    const account = await getOrCreateAccount(userId(req));
    const rows = await db
      .select()
      .from(affiliateWithdrawalsTable)
      .where(eq(affiliateWithdrawalsTable.affiliateId, account.id))
      .orderBy(desc(affiliateWithdrawalsTable.createdAt))
      .limit(50);
    res.json({ withdrawals: rows });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore interno" });
  }
});

// ── POST /api/admin/affiliate/commission  (webhook Stripe / cron) ─────────────
// Body: { affiliateId, referredUserId, month? }
affiliateRouter.post("/admin/commission", requireAdmin, async (req, res) => {
  try {
    const { affiliateId, referredUserId, month, isNewReferral } = req.body as {
      affiliateId:     number;
      referredUserId:  number;
      month?:          string;
      isNewReferral?:  boolean;
    };
    if (!affiliateId || !referredUserId) {
      res.status(400).json({ error: "affiliateId e referredUserId obbligatori" }); return;
    }
    const result = await recordMonthlyCommission(affiliateId, referredUserId, month);
    if (isNewReferral) await incrementReferralCount(affiliateId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore interno" });
  }
});
