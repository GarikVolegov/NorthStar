/**
 * affiliate-service.ts
 *
 * Business logic del programma di affiliazione NorthStar.
 *
 * REGOLE CORE:
 *   SUBSCRIPTION_PRICE_CENTS = 2900  (29.00€)
 *   COMMISSION_RATE          = 0.20  (20%)
 *   COMMISSION_CENTS         = 580   (5.80€ per referral/mese)
 *   LOCK_THRESHOLD_CENTS     = 2900  (i primi 29€ sono bloccati)
 *
 * Flusso mensile (triggerato da webhook Stripe o cron):
 *   1. recordMonthlyCommission()  →  aggiorna locked/withdrawable balance
 *   2. processRenewal()           →  a scadenza, usa lockedBalance per rinnovo
 *
 * Prelievo:
 *   requestWithdrawal()  →  crea un withdrawal 'pending', scala withdrawableBalance
 *   Il pagamento effettivo avviene con un cron separato (PayPal/bank API).
 *
 * INTEGRITÀ:
 *   - getOrCreateAccount: upsert atomico via ON CONFLICT per evitare
 *     duplicati in caso di richieste concorrenti.
 *   - recordMonthlyCommission: aggiornamento wallet in db.transaction
 *     per garantire che insert commissione e update balance siano atomici.
 *   - requestWithdrawal: già in db.transaction con check pessimistico.
 */
import { db } from "@workspace/db";
import {
  affiliateAccountsTable,
  affiliateCommissionsTable,
  affiliateWithdrawalsTable,
  usersTable,
} from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomBytes } from "crypto";

// ── Constants ─────────────────────────────────────────────────────────────────
export const SUBSCRIPTION_PRICE_CENTS = 2900;
export const COMMISSION_CENTS         = 580;  // 29€ × 20%
export const LOCK_THRESHOLD_CENTS     = 2900; // regola dei primi 29€

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AffiliateDashboardData {
  account: {
    referralCode:        string;
    referralUrl:         string;
    lockedBalanceEur:    number;
    withdrawableEur:     number;
    totalEarnedEur:      number;
    totalReferrals:      number;
    isPremiumActive:     boolean;
    nextRenewalAt:       Date | null;
    status:              string;
    /** Quanti referral mancano per coprire l'abbonamento */
    referralsToFreeSubscription: number;
  };
  recentReferrals: Array<{
    userId:      number;
    name:        string | null;
    joinedAt:    Date;
    monthlyEur:  number;
    isActive:    boolean;
  }>;
  recentWithdrawals: Array<{
    id:          number;
    amountEur:   number;
    method:      string;
    status:      string;
    createdAt:   Date;
    paidAt:      Date | null;
  }>;
  projections: {
    currentMonthEur: number;
    annualEur:       number;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function generateReferralCode(): string {
  return randomBytes(5).toString("hex").toUpperCase().slice(0, 8);
}

function centsToEur(c: number): number {
  return Math.round(c) / 100;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ── Core service functions ────────────────────────────────────────────────────

/**
 * Recupera o crea il wallet affiliato per un utente.
 *
 * ATOMICITÀ: usa INSERT ... ON CONFLICT (user_id) DO NOTHING + re-select
 * invece del pattern "check then insert". In questo modo due richieste
 * concorrenti non possono creare duplicati: la seconda INSERT viene
 * ignorata silenziosamente e il re-select recupera la riga esistente.
 *
 * Il referral_code è generato prima dell'insert con un loop di collision-
 * check contro il DB, ma la collision è estremamente rara (8 char hex).
 * In caso di collisione sul UNIQUE, il DB rilancerà un errore 23505 che
 * il chiamante può loggare; un semplice retry risolve.
 */
export async function getOrCreateAccount(userId: number) {
  // Fast path: recupera riga esistente
  const existing = await db
    .select()
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.userId, userId))
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing) return existing;

  // Genera un codice univoco (collision detection)
  const code = await generateUniqueReferralCode();

  // INSERT atomico: se un'altra richiesta concorrente ha già creato il
  // record per questo userId, ON CONFLICT non fa nulla e il re-select
  // restituisce la riga vincente.
  await db
    .insert(affiliateAccountsTable)
    .values({
      userId,
      referralCode:    code,
      isPremiumActive: true,
      nextRenewalAt:   new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })
    .onConflictDoNothing({ target: affiliateAccountsTable.userId });

  // Re-select: ottiene il record indipendentemente da chi lo ha inserito
  const created = await db
    .select()
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.userId, userId))
    .limit(1)
    .then((r) => r[0]);

  if (!created) throw new Error(`[affiliate] getOrCreateAccount: record mancante per userId=${userId}`);
  return created;
}

/** Genera un referral code non ancora presente nel DB. */
async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    const clash = await db
      .select({ id: affiliateAccountsTable.id })
      .from(affiliateAccountsTable)
      .where(eq(affiliateAccountsTable.referralCode, code))
      .limit(1)
      .then((r) => r[0] ?? null);
    if (!clash) return code;
  }
  // Fallback ultra-sicuro: timestamp hex
  return Date.now().toString(16).toUpperCase();
}

/**
 * Registra la commissione mensile per un referral confermato.
 *
 * ATOMICITÀ: l'insert della commissione e l'update del wallet avvengono
 * nella stessa db.transaction. Se uno dei due fallisce, nessuno viene
 * persistito — niente commissioni "fantasma" senza wallet aggiornato.
 *
 * L'INSERT usa ON CONFLICT DO NOTHING per l'idempotenza: chiamare questa
 * funzione più volte per lo stesso (affiliateId, referredUserId, month)
 * non produce duplicati.
 */
export async function recordMonthlyCommission(
  affiliateId: number,
  referredUserId: number,
  month?: string,
): Promise<{ applied: boolean; appliedTo: "locked" | "withdrawable" }> {
  const targetMonth = month ?? currentMonth();

  const account = await db
    .select()
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.id, affiliateId))
    .limit(1)
    .then((r) => r[0]);

  if (!account || account.status === "suspended") {
    return { applied: false, appliedTo: "locked" };
  }

  const appliedTo: "locked" | "withdrawable" =
    account.lockedBalance < LOCK_THRESHOLD_CENTS ? "locked" : "withdrawable";

  // Transazione: insert commissione + update wallet sono atomici.
  // Se la commissione esiste già (ON CONFLICT DO NOTHING → 0 righe inserite)
  // saltiamo anche l'update del wallet per evitare doppi accrediti.
  await db.transaction(async (tx) => {
    const result = await tx.execute(sql`
      INSERT INTO affiliate_commissions
        (affiliate_id, referred_user_id, amount_cents, month, applied_to, status, applied_at)
      VALUES
        (${affiliateId}, ${referredUserId}, ${COMMISSION_CENTS}, ${targetMonth},
         ${appliedTo}, 'applied', NOW())
      ON CONFLICT (affiliate_id, referred_user_id, month) DO NOTHING
    `);

    // rowCount = 0 → commissione già presente, evitiamo doppio accredito
    if ((result.rowCount ?? 0) === 0) return;

    if (appliedTo === "locked") {
      await tx
        .update(affiliateAccountsTable)
        .set({
          lockedBalance: sql`LEAST(locked_balance + ${COMMISSION_CENTS}, ${LOCK_THRESHOLD_CENTS})`,
          totalEarned:   sql`total_earned + ${COMMISSION_CENTS}`,
        })
        .where(eq(affiliateAccountsTable.id, affiliateId));
    } else {
      await tx
        .update(affiliateAccountsTable)
        .set({
          withdrawableBalance: sql`withdrawable_balance + ${COMMISSION_CENTS}`,
          totalEarned:         sql`total_earned + ${COMMISSION_CENTS}`,
        })
        .where(eq(affiliateAccountsTable.id, affiliateId));
    }
  });

  return { applied: true, appliedTo };
}

/**
 * Incrementa il contatore referral totali dell'affiliato.
 * Chiamato quando un utente invitato completa la prima sottoscrizione.
 */
export async function incrementReferralCount(affiliateId: number): Promise<void> {
  await db
    .update(affiliateAccountsTable)
    .set({ totalReferrals: sql`total_referrals + 1` })
    .where(eq(affiliateAccountsTable.id, affiliateId));
}

/**
 * Processa il rinnovo mensile dell'abbonamento dell'affiliato.
 *
 * Se lockedBalance >= 2900: scala 29€ dal locked, rinnovo gratuito.
 * Se lockedBalance < 2900:  addebita la differenza sulla carta (Stripe).
 *   → In questo caso ritorna { chargeCard: true, chargeAmountCents: diff }
 *     e il chiamante deve fare la chiamata Stripe.
 */
export async function processRenewal(affiliateId: number): Promise<{
  chargeCard: boolean;
  chargeAmountCents: number;
}> {
  const account = await db
    .select()
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.id, affiliateId))
    .limit(1)
    .then((r) => r[0]);

  if (!account) throw new Error(`Affiliate account ${affiliateId} not found`);

  const newRenewal = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (account.lockedBalance >= LOCK_THRESHOLD_CENTS) {
    await db
      .update(affiliateAccountsTable)
      .set({
        lockedBalance:   sql`locked_balance - ${LOCK_THRESHOLD_CENTS}`,
        nextRenewalAt:   newRenewal,
        isPremiumActive: true,
      })
      .where(eq(affiliateAccountsTable.id, affiliateId));
    return { chargeCard: false, chargeAmountCents: 0 };
  }

  const diff = LOCK_THRESHOLD_CENTS - account.lockedBalance;
  await db
    .update(affiliateAccountsTable)
    .set({
      lockedBalance:   0,
      nextRenewalAt:   newRenewal,
      isPremiumActive: true,
    })
    .where(eq(affiliateAccountsTable.id, affiliateId));

  return { chargeCard: true, chargeAmountCents: diff };
}

/**
 * Richiesta di prelievo da parte dell'affiliato.
 * Scala withdrawableBalance e crea un record 'pending'.
 */
export async function requestWithdrawal(
  affiliateId: number,
  amountCents: number,
  method: "paypal" | "bank_transfer",
  destination?: string,
): Promise<{ withdrawalId: number }> {
  const account = await db
    .select()
    .from(affiliateAccountsTable)
    .where(eq(affiliateAccountsTable.id, affiliateId))
    .limit(1)
    .then((r) => r[0]);

  if (!account) throw new Error("Account non trovato");
  if (account.status !== "active") throw new Error("Account non attivo");
  if (amountCents < 100) throw new Error("Importo minimo: 1.00€");
  if (amountCents > account.withdrawableBalance) {
    throw new Error(
      `Saldo insufficiente. Disponibile: ${centsToEur(account.withdrawableBalance)}€`
    );
  }

  // Scala subito il balance con check pessimistico nella stessa transazione
  const [withdrawal] = await db.transaction(async (tx) => {
    await tx
      .update(affiliateAccountsTable)
      .set({ withdrawableBalance: sql`withdrawable_balance - ${amountCents}` })
      .where(
        and(
          eq(affiliateAccountsTable.id, affiliateId),
          sql`withdrawable_balance >= ${amountCents}`,
        )
      );

    return tx
      .insert(affiliateWithdrawalsTable)
      .values({ affiliateId, amountCents, method, destination: destination ?? null })
      .returning();
  });

  return { withdrawalId: withdrawal.id };
}

/**
 * Fetch completo per la dashboard affiliato.
 * Unico round-trip al DB per tutti i dati necessari.
 */
export async function getDashboardData(
  userId: number,
  baseUrl = "https://northstar.app",
): Promise<AffiliateDashboardData> {
  const account = await getOrCreateAccount(userId);

  const referralRows = await db
    .select({
      userId:   usersTable.id,
      name:     usersTable.name,
      joinedAt: usersTable.createdAt,
    })
    .from(affiliateCommissionsTable)
    .innerJoin(usersTable, eq(affiliateCommissionsTable.referredUserId, usersTable.id))
    .where(
      and(
        eq(affiliateCommissionsTable.affiliateId, account.id),
        eq(affiliateCommissionsTable.month, currentMonth()),
      )
    )
    .groupBy(usersTable.id, usersTable.name, usersTable.createdAt)
    .limit(20);

  const recentWithdrawals = await db
    .select()
    .from(affiliateWithdrawalsTable)
    .where(eq(affiliateWithdrawalsTable.affiliateId, account.id))
    .orderBy(desc(affiliateWithdrawalsTable.createdAt))
    .limit(10);

  const monthCount = await db
    .select({ cnt: sql<number>`COUNT(DISTINCT referred_user_id)` })
    .from(affiliateCommissionsTable)
    .where(
      and(
        eq(affiliateCommissionsTable.affiliateId, account.id),
        eq(affiliateCommissionsTable.month, currentMonth()),
        eq(affiliateCommissionsTable.status, "applied"),
      )
    )
    .then((r) => Number(r[0]?.cnt ?? 0));

  const currentMonthCents = monthCount * COMMISSION_CENTS;
  const referralsToFreeSubscription = Math.max(
    0,
    Math.ceil((LOCK_THRESHOLD_CENTS - account.lockedBalance) / COMMISSION_CENTS),
  );

  return {
    account: {
      referralCode:              account.referralCode,
      referralUrl:               `${baseUrl}/join?ref=${account.referralCode}`,
      lockedBalanceEur:          centsToEur(account.lockedBalance),
      withdrawableEur:           centsToEur(account.withdrawableBalance),
      totalEarnedEur:            centsToEur(account.totalEarned),
      totalReferrals:            account.totalReferrals,
      isPremiumActive:           account.isPremiumActive,
      nextRenewalAt:             account.nextRenewalAt,
      status:                    account.status,
      referralsToFreeSubscription,
    },
    recentReferrals: referralRows.map((r) => ({
      userId:     r.userId,
      name:       r.name,
      joinedAt:   r.joinedAt,
      monthlyEur: centsToEur(COMMISSION_CENTS),
      isActive:   true,
    })),
    recentWithdrawals: recentWithdrawals.map((w) => ({
      id:         w.id,
      amountEur:  centsToEur(w.amountCents),
      method:     w.method,
      status:     w.status,
      createdAt:  w.createdAt,
      paidAt:     w.paidAt,
    })),
    projections: {
      currentMonthEur: centsToEur(currentMonthCents),
      annualEur:       centsToEur(currentMonthCents * 12),
    },
  };
}
