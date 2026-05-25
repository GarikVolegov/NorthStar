import { getUncachableStripeClient } from './stripeClient';

async function createProducts() {
  try {
    const stripe = await getUncachableStripeClient();

    console.log('Creating Orientamento Premium products in Stripe...');

    const existing = await stripe.products.search({
      query: "name:'Orientamento Premium' AND active:'true'"
    });

    if (existing.data.length > 0) {
      const existingProduct = existing.data[0];
      if (!existingProduct) {
        throw new Error('Stripe returned an empty product result');
      }
      console.log('Orientamento Premium already exists. Skipping creation.');
      console.log(`Product ID: ${existingProduct.id}`);

      const prices = await stripe.prices.list({ product: existingProduct.id, active: true });
      for (const p of prices.data) {
        console.log(`  Price: ${p.id} — ${p.unit_amount! / 100} ${p.currency.toUpperCase()}/${p.recurring?.interval}`);
      }
      return;
    }

    const product = await stripe.products.create({
      name: 'Orientamento Premium',
      description: 'Accesso completo alla Wiki AI, grafo della conoscenza e roadmap personalizzata',
      metadata: {
        tier: 'premium',
        platform: 'orientamento',
      },
    });
    console.log(`Created product: ${product.name} (${product.id})`);

    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 900,
      currency: 'eur',
      recurring: { interval: 'month' },
    });
    console.log(`Created monthly price: €9.00/mese (${monthlyPrice.id})`);

    const yearlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: 9000,
      currency: 'eur',
      recurring: { interval: 'year' },
    });
    console.log(`Created yearly price: €90.00/anno (${yearlyPrice.id})`);

    console.log('\n✓ Prodotti creati con successo!');
    console.log('I webhook sincronizzeranno automaticamente i dati nel database.');

  } catch (error: any) {
    console.error('Errore nella creazione dei prodotti:', error.message);
    process.exit(1);
  }
}

createProducts();
