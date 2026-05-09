import { Router } from "express";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";
import { authMiddleware } from "../lib/auth-jwt.js";

const router = Router();

// ── GET /api/stripe/products — pubblico: lista prodotti e prezzi ──────────────
router.get("/stripe/products", async (_req, res): Promise<void> => {
  const rows = await storage.listProductsWithPrices();

  const productsMap = new Map<string, {
    id: string; name: string; description: string | null;
    metadata: unknown; prices: Array<{ id: string; unitAmount: number | null; currency: string; recurring: unknown }>;
  }>();

  for (const row of rows) {
    if (!productsMap.has(row.product_id as string)) {
      productsMap.set(row.product_id as string, {
        id: row.product_id as string,
        name: row.product_name as string,
        description: row.product_description as string | null,
        metadata: row.product_metadata,
        prices: [],
      });
    }
    if (row.price_id) {
      productsMap.get(row.product_id as string)!.prices.push({
        id: row.price_id as string,
        unitAmount: row.unit_amount as number | null,
        currency: row.currency as string,
        recurring: row.recurring,
      });
    }
  }

  res.json({ data: Array.from(productsMap.values()) });
});

// ── POST /api/stripe/checkout — crea sessione checkout Stripe ────────────────
router.post("/stripe/checkout", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const { priceId, userEmail } = req.body as { priceId: string; userEmail?: string };

  if (!priceId) {
    res.status(400).json({ error: "priceId è obbligatorio" });
    return;
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Stripe non configurato" });
    return;
  }

  const stripe = await getUncachableStripeClient();

  let customerId: string | undefined;

  const user = await storage.getUserById(userId);
  if (user?.stripeCustomerId) {
    customerId = user.stripeCustomerId;
  } else if (user) {
    const customer = await stripe.customers.create({
      email: user.email ?? userEmail,
      name: user.name,
      metadata: { userId: String(user.id) },
    });
    await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
    customerId = customer.id;
  }

  const baseUrl = process.env.CORS_ORIGIN
    ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`
    ?? "http://localhost:5000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${baseUrl}/premium/successo?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/premium`,
  });

  res.json({ url: session.url });
});

// ── GET /api/stripe/subscription — stato abbonamento utente autenticato ───────
router.get("/stripe/subscription", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;

  if (!process.env.STRIPE_SECRET_KEY) {
    res.json({ subscription: null, isPremium: false });
    return;
  }

  const user = await storage.getUserById(userId);
  if (!user?.stripeSubscriptionId) {
    res.json({ subscription: null, isPremium: false });
    return;
  }

  const subscription = await storage.getSubscription(user.stripeSubscriptionId);
  const isPremium = subscription?.status === "active" || subscription?.status === "trialing";
  res.json({ subscription, isPremium });
});

// ── POST /api/stripe/portal — portale gestione abbonamento ───────────────────
router.post("/stripe/portal", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;

  if (!process.env.STRIPE_SECRET_KEY) {
    res.status(503).json({ error: "Stripe non configurato" });
    return;
  }

  const user = await storage.getUserById(userId);
  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "Nessun cliente Stripe associato all'account" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const baseUrl = process.env.CORS_ORIGIN
    ?? `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`
    ?? "http://localhost:5000";

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/premium`,
  });

  res.json({ url: portalSession.url });
});

export default router;
