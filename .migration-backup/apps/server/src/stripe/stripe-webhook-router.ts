/**
 * stripe-webhook-router.ts — POST /api/stripe/webhook
 *
 * Gestisce gli eventi Stripe per mantenere lo stato premium aggiornato
 * nel database e invalida la cache del profilo per garantire coerenza immediata.
 *
 * EVENTI GESTITI:
 *   customer.subscription.created   → imposta stripeSubscriptionId
 *   customer.subscription.updated   → aggiorna stripeSubscriptionId (es. plan change)
 *   customer.subscription.deleted   → rimuove stripeSubscriptionId (cancellazione)
 *
 * SICUREZZA:
 *   Ogni request viene verificata con stripe.webhooks.constructEvent().
 *   Usa express.raw() come body parser (NON express.json()) per validare la firma.
 *   Il router deve essere montato PRIMA di express.json() in index.ts, oppure
 *   la route deve ricevere il body grezzo (rawBody). Vedi index.ts per come è montato.
 *
 * ENV RICHIESTE:
 *   STRIPE_SECRET_KEY       — chiave segreta Stripe (sk_live_... / sk_test_...)
 *   STRIPE_WEBHOOK_SECRET   — secret del webhook Stripe (whsec_...)
 */
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { invalidateProfileCache } from "../lib/cache";

export const stripeWebhookRouter = Router();

const stripeSecret  = process.env.STRIPE_SECRET_KEY ?? "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const stripe = stripeSecret
  ? new Stripe(stripeSecret, { apiVersion: "2024-06-20" })
  : null;

// ── POST /webhook ─────────────────────────────────────────────────────────
// Il body deve arrivare grezzo (Buffer) per permettere la verifica della firma.
// index.ts monta questo router PRIMA di express.json(), quindi il body
// è ancora un Buffer raw (express.raw viene applicato solo su questa route).
stripeWebhookRouter.post(
  "/webhook",
  // express.raw() viene applicato inline per non interferire con le altre routes
  (req, res, next) => {
    // Se il body è già un Buffer (raw), procedi; altrimenti leggi raw
    if (Buffer.isBuffer(req.body)) return next();
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      (req as Request & { rawBody: string }).rawBody = data;
      req.body = data;
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!stripe) {
      console.warn("[stripe-webhook] STRIPE_SECRET_KEY non configurata, evento ignorato");
      res.json({ received: true });
      return;
    }

    if (!webhookSecret) {
      console.warn("[stripe-webhook] STRIPE_WEBHOOK_SECRET non configurata, evento ignorato");
      res.json({ received: true });
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig) {
      res.status(400).json({ error: "Manca stripe-signature header" });
      return;
    }

    let event: Stripe.Event;
    try {
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : Buffer.from((req as Request & { rawBody?: string }).rawBody ?? "", "utf8");
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
    } catch (err) {
      console.error("[stripe-webhook] Firma non valida:", err instanceof Error ? err.message : err);
      res.status(400).json({ error: "Firma webhook non valida" });
      return;
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpsert(sub);
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          await handleSubscriptionDeleted(sub);
          break;
        }
        default:
          // Evento non gestito — ignora silenziosamente
          break;
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[stripe-webhook] Errore elaborazione evento:", event.type, err);
      res.status(500).json({ error: "Errore elaborazione webhook" });
    }
  },
);

// ── Helpers ───────────────────────────────────────────────────────────────

async function resolveUserId(customerId: string): Promise<number | null> {
  const row = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.stripeCustomerId, customerId))
    .limit(1)
    .then((r) => r[0]);
  return row?.id ?? null;
}

async function handleSubscriptionUpsert(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await resolveUserId(customerId);

  if (!userId) {
    console.warn("[stripe-webhook] Utente non trovato per customerId:", customerId);
    return;
  }

  await db
    .update(usersTable)
    .set({
      stripeSubscriptionId: sub.id,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));

  await invalidateProfileCache(userId);
  console.log(`[stripe-webhook] subscription upsert → userId=${userId} sub=${sub.id}`);
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userId = await resolveUserId(customerId);

  if (!userId) {
    console.warn("[stripe-webhook] Utente non trovato per customerId:", customerId);
    return;
  }

  await db
    .update(usersTable)
    .set({
      stripeSubscriptionId: null,
      updatedAt: new Date(),
    })
    .where(eq(usersTable.id, userId));

  await invalidateProfileCache(userId);
  console.log(`[stripe-webhook] subscription deleted → userId=${userId}`);
}
