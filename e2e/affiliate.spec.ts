/**
 * E2E: private C2C referral dashboard mounted at /affiliate.
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, loginAsAffiliate, waitForAuthReady } from './helpers/auth';

test.describe('Route /affiliate', () => {
  test('redirect a /login se non autenticato', async ({ page }) => {
    await page.goto('/affiliate');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('preserva il redirect param: /login?redirect=%2Faffiliate', async ({ page }) => {
    await page.goto('/affiliate');
    await expect(page).toHaveURL(/redirect=%2Faffiliate/, { timeout: 10_000 });
  });

  test.describe('utente normale', () => {
    test.beforeEach(async ({ page }) => {
      await loginViaApi(page);
      await page.goto('/affiliate');
      await waitForAuthReady(page);
      await expect(page).toHaveURL(/\/affiliate/, { timeout: 10_000 });
    });

    test('la pagina si carica senza errori JS critici', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await expect(page.locator('header').or(page.locator('main'))).toBeVisible({ timeout: 10_000 });
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

    test('mostra subito il referral link', async ({ page }) => {
      const input = page.locator('input[readonly]').first();
      await expect(input).toBeVisible({ timeout: 20_000 });
      const value = await input.inputValue();
      expect(value).toMatch(/^https?:\/\/.+\/sign-up\?ref=/i);
    });

    test('mostra QR code personale e azione download', async ({ page }) => {
      await expect(page.getByAltText(/QR code del tuo link referral/i)).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole('button', { name: /scarica QR/i })).toBeVisible();
    });
  });

  test.describe('utente affiliato storico', () => {
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
          .or(page.getByText(/riserva/i)),
      ).toBeVisible({ timeout: 20_000 });
    });

    test('mostra il referral link', async ({ page }) => {
      const input = page.locator('input[readonly]').first();
      await expect(input).toBeVisible({ timeout: 20_000 });
      const value = await input.inputValue();
      expect(value).toMatch(/^https?:\/\/.+\/sign-up\?ref=/i);
    });

    test('copia il referral link con feedback visivo', async ({ page }) => {
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

    test('dialog conferma ritiro si apre e si chiude quando il saldo lo consente', async ({ page }) => {
      await page.waitForSelector('input[readonly]', { timeout: 20_000 });

      const withdrawBtn = page.getByRole('button', { name: /richiedi ritiro/i });
      const isDisabled = await withdrawBtn.isDisabled();

      if (isDisabled) {
        test.info().annotations.push({
          type: 'info',
          description: 'Saldo sotto soglia minima, dialog non testato',
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

  test('GET /api/affiliate/dashboard senza token -> 401', async ({ page }) => {
    const res = await page.request.get('/api/affiliate/dashboard');
    expect(res.status()).toBe(401);
  });

  test('GET /api/affiliate/dashboard con token valido -> 200', async ({ page }) => {
    const loginRes = await page.request.post('/api/auth/login', {
      data: {
        email: process.env.TEST_USER_EMAIL ?? 'test@northstar.app',
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
    expect(dashRes.status()).toBe(200);
  });
});
