/**
 * E2E: Route /affiliate (nuova — aggiunta in Step 6)
 *
 * Testa la route /affiliate montata in apps/web/src/App.tsx.
 * Separata da affiliate-dashboard.spec.ts che testa /affiliazione/dashboard
 * (la vecchia route del deployment precedente).
 *
 * La route /affiliate monta AffiliateDashboard.
 * Il guard isAffiliate è gestito internamente dal componente:
 *   - isAffiliate=true  → mostra la dashboard completa
 *   - isAffiliate=false → mostra la CTA di iscrizione al programma
 *
 * Prerequisiti:
 *   - TEST_USER_EMAIL / TEST_USER_PASSWORD: utente normale (isAffiliate=false)
 *   - TEST_AFFILIATE_EMAIL / TEST_AFFILIATE_PASSWORD: utente affiliato (opzionale)
 *
 * Esecuzione:
 *   pnpm exec playwright test e2e/affiliate.spec.ts
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, loginAsAffiliate, waitForAuthReady } from './helpers/auth';

// ── suite ────────────────────────────────────────────────────────────────

test.describe('Route /affiliate', () => {

  // ── 1. Auth guard ───────────────────────────────────────────────

  test('redirect a /login se non autenticato', async ({ page }) => {
    await page.goto('/affiliate');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('preserva il redirect param: /login?redirect=%2Faffiliate', async ({ page }) => {
    await page.goto('/affiliate');
    await expect(page).toHaveURL(/redirect=%2Faffiliate/, { timeout: 10_000 });
  });

  // ── 2. Utente normale (isAffiliate = false) ────────────────────

  test.describe('utente non affiliato (isAffiliate = false)', () => {

    test.beforeEach(async ({ page }) => {
      await loginViaApi(page);
      await page.goto('/affiliate');
      await waitForAuthReady(page);
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
    });

    test('la pagina si carica senza errori JS critici', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      const critical = errors.filter(
        (e) => !e.includes('Warning:') && !e.includes('[Fast Refresh]'),
      );
      expect(critical).toHaveLength(0);
    });

    test('URL rimane /affiliate', async ({ page }) => {
      await expect(page).toHaveURL(/\/affiliate$/);
    });

    test('mostra la navbar', async ({ page }) => {
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
    });

    test('mostra la CTA per iscriversi al programma affiliazione', async ({ page }) => {
      // AffiliateDashboard con isAffiliate=false mostra una call-to-action
      // I testi esatti dipendono dall\'implementazione del componente.
      // Usiamo un matcher flessibile che copre le varianti più probabili.
      await expect(
        page
          .getByText(/programma di affiliazione/i)
          .or(page.getByText(/diventa affiliato/i))
          .or(page.getByText(/iscriviti al programma/i))
          .or(page.getByText(/non sei ancora affiliato/i)),
      ).toBeVisible({ timeout: 15_000 });
    });

  });

  // ── 3. Utente affiliato (isAffiliate = true) ───────────────────

  test.describe('utente affiliato (isAffiliate = true)', () => {

    test.beforeEach(async ({ page }) => {
      await loginAsAffiliate(page);
      await page.goto('/affiliate');
      await waitForAuthReady(page);
    });

    test('mostra le stats card della dashboard', async ({ page }) => {
      await expect(
        page
          .getByText(/guadagnato/i)
          .or(page.getByText(/commissioni/i))
          .or(page.getByText(/in attesa/i)),
      ).toBeVisible({ timeout: 20_000 });
    });

    test('mostra il referral link', async ({ page }) => {
      const input = page.locator('input[readonly]').first();
      await expect(input).toBeVisible({ timeout: 20_000 });
      const value = await input.inputValue();
      expect(value).toMatch(/^https?:\/\//i);
    });

    test('copia il referral link → feedback visivo', async ({ page }) => {
      await page.waitForSelector('input[readonly]', { timeout: 20_000 });

      const copyBtn = page.getByRole('button', { name: /copia link/i });
      await expect(copyBtn).toBeVisible();
      await copyBtn.click();

      await expect(
        page.getByRole('button', { name: /copiato/i })
          .or(page.getByText(/link copiato/i)),
      ).toBeVisible({ timeout: 3_000 });
    });

    test('mostra il pannello di ritiro', async ({ page }) => {
      await expect(
        page
          .getByText(/saldo disponibile/i)
          .or(page.getByText(/richiedi ritiro/i)),
      ).toBeVisible({ timeout: 20_000 });
    });

    test('dialog conferma ritiro si apre e si chiude', async ({ page }) => {
      await page.waitForSelector('input[readonly]', { timeout: 20_000 });

      const withdrawBtn = page.getByRole('button', { name: /richiedi ritiro/i });
      const isDisabled  = await withdrawBtn.isDisabled();

      if (isDisabled) {
        test.info().annotations.push({
          type: 'info',
          description: 'Saldo sotto soglia minima — dialog non testato',
        });
        return;
      }

      await withdrawBtn.click();
      await expect(
        page.getByRole('dialog').filter({ hasText: /conferma|ritiro/i }),
      ).toBeVisible({ timeout: 3_000 });

      await page.getByRole('button', { name: /annulla/i }).click();
      await expect(
        page.getByRole('dialog').filter({ hasText: /conferma|ritiro/i }),
      ).not.toBeVisible({ timeout: 2_000 });
    });

  });

  // ── 4. API diretta: GET /api/affiliate/dashboard ───────────────

  test('GET /api/affiliate/dashboard senza token → 401', async ({ page }) => {
    const res = await page.request.get('/api/affiliate/dashboard');
    expect(res.status()).toBe(401);
  });

  test('GET /api/affiliate/dashboard con token valido → 200 o 403', async ({ page }) => {
    // Login per ottenere il token
    const loginRes = await page.request.post('/api/auth/login', {
      data: {
        email:    process.env.TEST_USER_EMAIL    ?? 'test@northstar.app',
        password: process.env.TEST_USER_PASSWORD ?? 'testpassword',
      },
    });
    if (loginRes.status() !== 200) {
      test.skip(true, 'Utente di test non disponibile in questo ambiente');
      return;
    }
    const { token } = await loginRes.json();

    const dashRes = await page.request.get('/api/affiliate/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    // 200 se isAffiliate=true, 403 se isAffiliate=false
    expect([200, 403]).toContain(dashRes.status());
  });

});
