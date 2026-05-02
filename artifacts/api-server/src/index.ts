import app from "./app";
import { logger } from "./lib/logger";
import { seedSectors } from "./lib/seed";
import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  try {
    logger.info('Initializing Stripe schema...');
    await runMigrations({ databaseUrl });
    logger.info('Stripe schema ready');

    const stripeSync = await getStripeSync();

    const webhookBaseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
    await stripeSync.findOrCreateManagedWebhook(`${webhookBaseUrl}/api/stripe/webhook`);
    logger.info('Stripe webhook configured');

    stripeSync.syncBackfill()
      .then(() => logger.info('Stripe data synced'))
      .catch((err) => logger.error({ err }, 'Error syncing Stripe data'));
  } catch (error) {
    logger.error({ err: error }, 'Failed to initialize Stripe');
    throw error;
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  try {
    await seedSectors();
    logger.info("Sectors seeded successfully");
  } catch (seedErr) {
    logger.error({ err: seedErr }, "Failed to seed sectors");
  }

  try {
    await initStripe();
  } catch (stripeErr) {
    logger.warn({ err: stripeErr }, "Stripe initialization failed — payments unavailable until Stripe is connected");
  }
});
