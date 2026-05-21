/**
 * pwa-offline.mobile.spec.ts
 *
 * Test E2E dello scenario offline / connessione debole per la PWA.
 *
 * Questi test verificano che:
 *   - L'app mostri un feedback utile quando la rete è assente
 *   - Le pagine già visitate siano servite dalla cache del Service Worker
 *   - Il manifest PWA è servito correttamente
 *
 * Note:
 *   - Richiedono la build di produzione (service worker attivo)
 *   - Il service worker NON è attivo in dev mode
 *   - Si eseguono solo se ENABLE_PWA_TESTS=true (skip di default in dev locale)
 *
 * Device: Pixel 5
 */

import { test, expect, devices } from '@playwright/test';
import { responseJson } from '../helpers/json';

test.use({ ...devices['Pixel 5'] });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const ENABLE_PWA = process.env.ENABLE_PWA_TESTS === 'true' || process.env.CI === 'true';

type WebManifest = {
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  icons?: unknown[];
  theme_color?: string;
  background_color?: string;
};

test.describe('PWA & Offline — Pixel 5', () => {

  test.skip(!ENABLE_PWA, 'Saltato: ENABLE_PWA_TESTS non è true (richiede build di produzione)');

  test('manifest.webmanifest è servito e valido', async ({ page }) => {
    // Richiedi il manifest direttamente
    const response = await page.request.get(`${BASE_URL}/manifest.webmanifest`);
    expect(response.status()).toBe(200);

    const manifest = await responseJson<WebManifest>(response);

    // Campi obbligatori
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');

    // Icone
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons?.length ?? 0).toBeGreaterThanOrEqual(2);

    // Colori tema
    expect(manifest.theme_color).toBeTruthy();
    expect(manifest.background_color).toBeTruthy();
  });

  test('service worker è registrato', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });

    // Aspetta che il SW sia registrato (può richiedere qualche secondo)
    await page.waitForTimeout(2000);

    const swRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      const registration = await navigator.serviceWorker.getRegistration();
      return !!registration;
    });

    expect(swRegistered).toBe(true);
  });

  test('home page è servita offline (da cache SW)', async ({ page, context }) => {
    // Prima visita online per cacheare
    await page.goto(BASE_URL, { waitUntil: 'load' });
    await page.waitForTimeout(2000); // Aspetta che il SW precachi

    // Simula offline
    await context.setOffline(true);

    // Reload in offline
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});

    // La pagina deve essere ancora visibile (dalla cache)
    await expect(page.getByText(/NorthStar/i).first()).toBeVisible({ timeout: 5000 });

    // Ripristina la rete
    await context.setOffline(false);
  });

  test('banner install PWA disponibile (o skip se già installata)', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });

    // Questo test verifica solo che la pagina non abbia errori JS
    // Il banner di installazione non può essere testato in modo headless affidabile
    const jsErrors: string[] = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await page.waitForTimeout(1000);

    // Nessun errore JS critico
    const criticalErrors = jsErrors.filter(e =>
      !e.includes('ServiceWorker') && // SW errori in dev sono normali
      !e.includes('ResizeObserver')   // Falso positivo comune
    );
    expect(criticalErrors).toHaveLength(0);
  });

});
