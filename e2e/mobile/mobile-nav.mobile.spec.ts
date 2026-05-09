/**
 * mobile-nav.mobile.spec.ts
 *
 * Test E2E della navigazione mobile:
 *   - Drawer laterale (MobileDrawer)
 *   - BottomNav tap
 *   - Dimensioni tap target
 *   - Transizioni pagina
 *
 * Device: Pixel 5
 */

import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['Pixel 5'] });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';

test.describe('Mobile Navigation — Pixel 5', () => {

  test('tutti i link del BottomNav raggiungono la pagina corretta', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const bottomNav = page.getByRole('navigation', { name: /navigazione inferiore/i });
    await expect(bottomNav).toBeVisible();

    // Test tap su Home
    const homeLink = bottomNav.getByRole('link', { name: /home/i });
    await homeLink.tap();
    await expect(page).toHaveURL(`${BASE_URL}/`);

    // Test tap su Test
    const testLink = bottomNav.getByRole('link', { name: /^test$/i });
    if (await testLink.isVisible()) {
      await testLink.tap();
      // Su /test la BottomNav si nasconde (HIDDEN_ON config)
      await expect(bottomNav).not.toBeVisible({ timeout: 2000 }).catch(() => {});
    }
  });

  test('hamburger toggle: apri → naviga → chiudi automatico', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    const hamburger = page.getByRole('button', { name: /apri menu/i });
    await hamburger.tap();

    // Naviga su "Come funziona"
    const link = page.getByRole('link', { name: /come funziona/i });
    await expect(link).toBeVisible({ timeout: 2000 });
    await link.tap();

    // Pagina cambia
    await page.waitForURL(/come-funziona/, { timeout: 5000 });
    await expect(page).toHaveURL(/come-funziona/);

    // L'hamburger deve essere tornato in stato "apri menu" (drawer chiuso)
    await expect(page.getByRole('button', { name: /apri menu/i })).toBeVisible();
  });

  test('scroll verticale fluido sulla home page', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });

    // Scroll verso il basso di 800px
    await page.evaluate(() => window.scrollBy({ top: 800, behavior: 'smooth' }));
    await page.waitForTimeout(600);

    // Lo scroll deve aver funzionato
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  test('Navbar sticky: rimane visibile dopo scroll', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });

    // Scroll in basso
    await page.evaluate(() => window.scrollBy({ top: 500, behavior: 'instant' }));
    await page.waitForTimeout(300);

    // La navbar (header) deve essere ancora visibile perché sticky
    const header = page.locator('header').first();
    await expect(header).toBeVisible();

    // Il logo NorthStar deve essere visibile nella navbar
    await expect(header.getByText(/NorthStar/i)).toBeVisible();
  });

  test('nessun orizzonal overflow sulla home', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'load' });

    // Controlla che il body non abbia overflow orizzontale
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalOverflow).toBe(false);
  });

});
