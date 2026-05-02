import { Router } from "express";
import { storage } from "../storage";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

router.get("/stripe/products", async (_req, res): Promise<void> => {
  const rows = await storage.listProductsWithPrices();

  const productsMap = new Map<string, any>();
  for (const row of rows) {
    if (!productsMap.has(row.product_id as string)) {
      productsMap.set(row.product_id as string, {
        id: row.product_id,
        name: row.product_name,
        description: row.product_description,
        metadata: row.product_metadata,
        prices: []
      });
    }
    if (row.price_id) {
      productsMap.get(row.product_id as string).prices.push({
        id: row.price_id,
        unitAmount: row.unit_amount,
        currency: row.currency,
        recurring: row.recurring,
      });
    }
  }

  res.json({ data: Array.from(productsMap.values()) });
});

router.post("/stripe/checkout", async (req, res): Promise<void> => {
  const { priceId, userId, userEmail } = req.body as {
    priceId: string;
    userId?: number;
    userEmail?: string;
  };

  if (!priceId) {
    res.status(400).json({ error: "priceId is required" });
    return;
  }

  const stripe = await getUncachableStripeClient();

  let customerId: string | undefined;

  if (userId) {
    const user = await storage.getUserById(userId);
    if (user?.stripeCustomerId) {
      customerId = user.stripeCustomerId;
    } else if (user) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: { userId: String(user.id) },
      });
      await storage.updateUserStripeInfo(user.id, { stripeCustomerId: customer.id });
      customerId = customer.id;
    }
  } else if (userEmail) {
    const customer = await stripe.customers.create({ email: userEmail });
    customerId = customer.id;
  }

  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${baseUrl}/premium/successo?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/premium`,
  });

  res.json({ url: session.url });
});

router.get("/stripe/subscription/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (!userId) {
    res.status(400).json({ error: "Invalid userId" });
    return;
  }

  const user = await storage.getUserById(userId);
  if (!user?.stripeSubscriptionId) {
    res.json({ subscription: null, isPremium: false });
    return;
  }

  const subscription = await storage.getSubscription(user.stripeSubscriptionId);
  const isPremium = subscription?.status === 'active' || subscription?.status === 'trialing';
  res.json({ subscription, isPremium });
});

router.post("/stripe/portal", async (req, res): Promise<void> => {
  const { userId } = req.body as { userId: number };
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const user = await storage.getUserById(userId);
  if (!user?.stripeCustomerId) {
    res.status(400).json({ error: "No Stripe customer found for this user" });
    return;
  }

  const stripe = await getUncachableStripeClient();
  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${baseUrl}/premium`,
  });

  res.json({ url: portalSession.url });
});

export default router;
