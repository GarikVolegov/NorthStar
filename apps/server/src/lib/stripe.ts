/**
 * stripe.ts — client Stripe condiviso + mappa price-ID ↔ piano.
 *
 * Il client è istanziato in modo lazy (singleton): se STRIPE_SECRET_KEY non è
 * impostata il modulo NON crasha all'import — l'errore (fail-closed) viene
 * sollevato solo quando un endpoint che richiede Stripe chiama getStripe().
 * Questo mantiene funzionante il path del webhook (che usa solo
 * stripe.webhooks.constructEvent) anche senza la chiave segreta in alcuni
 * ambienti di test.
 *
 * SECURITY: la chiave segreta non viene mai loggata né restituita al client.
 */
import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Restituisce il client Stripe singleton. Fail-closed: se manca
 * STRIPE_SECRET_KEY solleva un errore chiaro (solo a chiamata effettiva).
 */
export function getStripe(): Stripe {
  if (_stripe) return _stripe;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "STRIPE_SECRET_KEY non configurata: il checkout/billing Stripe è disabilitato",
    );
  }

  _stripe = new Stripe(secretKey);
  return _stripe;
}

/** Indica se Stripe è configurato (per gestione soft lato endpoint). */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// ── Catalogo piani (price-ID ↔ piano) ─────────────────────────────────────────

export const PAID_PLANS = ["pro", "team"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export interface PlanConfig {
  plan: PaidPlan;
  interval: BillingInterval;
  priceId: string | undefined;
  amountEur: number;
}

/** Importo display (in euro) letto da env con fallback sensato. */
function amountEurFor(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

/**
 * Catalogo dei piani configurati. I priceId vengono letti dall'ambiente; se
 * non impostati restano `undefined` (l'endpoint /upgrade fallirà in modo
 * controllato per quel piano). Gli importi display servono solo alla FE.
 */
export function getPlanCatalog(): PlanConfig[] {
  return [
    {
      plan: "pro",
      interval: "monthly",
      priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID,
      amountEur: amountEurFor("STRIPE_PRO_MONTHLY_PRICE_EUR", 9),
    },
    {
      plan: "pro",
      interval: "yearly",
      priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID,
      amountEur: amountEurFor("STRIPE_PRO_YEARLY_PRICE_EUR", 90),
    },
    {
      plan: "team",
      interval: "monthly",
      priceId: process.env.STRIPE_TEAM_MONTHLY_PRICE_ID,
      amountEur: amountEurFor("STRIPE_TEAM_MONTHLY_PRICE_EUR", 29),
    },
    {
      plan: "team",
      interval: "yearly",
      priceId: process.env.STRIPE_TEAM_YEARLY_PRICE_ID,
      amountEur: amountEurFor("STRIPE_TEAM_YEARLY_PRICE_EUR", 290),
    },
  ];
}

/** Restituisce il price-ID Stripe per (piano, intervallo), o undefined. */
export function priceIdFor(
  plan: PaidPlan,
  interval: BillingInterval,
): string | undefined {
  return getPlanCatalog().find(
    (p) => p.plan === plan && p.interval === interval,
  )?.priceId;
}

/**
 * Risolve il piano a partire da un price-ID Stripe.
 * Ritorna "free" se il price-ID non è mappato (fail-safe per il webhook).
 */
export function planForPriceId(priceId: string | undefined): PaidPlan | "free" {
  if (!priceId) return "free";
  const match = getPlanCatalog().find((p) => p.priceId === priceId);
  return match?.plan ?? "free";
}
