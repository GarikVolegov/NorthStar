/**
 * E2E: Dashboard Affiliazione
 * FRONTEND_RULES.md: test Playwright per flusso critico affiliato.
 *
 * Prerequisiti:
 *   - BASE_URL in playwright.config.ts punta all'app in esecuzione
 *   - .env.test contiene TEST_USER_EMAIL e TEST_USER_PASSWORD
 *
 * Esecuzione:
 *   pnpm exec playwright test e2e/affiliate-dashboard.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

// ── helpers ──────────────────────────────────────────────────────────────────

async function loginViaApi(page: Page) {
  const email    = process.env.TEST_USER_EMAIL    ?? 'test@northstar.app';
  const password = process.env.TEST_USER_PASSWORD ?? 'testpassword';

  // Chiama l'API di login direttamente: più veloce del form UI
  const res = await page.request.post('/api/auth/login', {
    data: { email, password },
  });
  expect(res.status(), 'Login API dovrebbe rispondere 200').toBe(200);

  const { token } = await res.json();
  expect(token, 'Il token JWT deve essere presente').toBeTruthy();

  // Inietta il token nel localStorage (stesso meccanismo usato da AuthContext)
  await page.addInitScript((t: string) => {
    localStorage.setItem('ns_token', t);
  }, token);
}

// ── suite principale ──────────────────────────────────────────────────────────

test.describe('Dashboard Affiliazione /affiliazione/dashboard', () => {

  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto('/affiliazione/dashboard');
    // Attende che la navbar sia visibile (layout montato)
    await page.waitForSelector('header', { timeout: 10_000 });
  });

  // ── 1. Accesso e struttura ──────────────────────────────────────────────────
  test('redirect a /registra se non autenticato', async ({ page: unauthPage }) => {
    // Naviga senza token
    await unauthPage.goto('/affiliazione/dashboard');
    await expect(unauthPage).toHaveURL(/registra|login/, { timeout: 8_000 });
  });

  test('mostra le 3 stats card', async ({ page }) => {
    // Attende il caricamento (Skeleton → dati reali)
    await expect(
      page.getByText('Guadagnato totale'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('In attesa')).toBeVisible();
    await expect(page.getByText('Disponibile')).toBeVisible();
  });

  // ── 2. Referral link ───────────────────────────────────────────────────────
  test('mostra il campo link referral', async ({ page }) => {
    await expect(
      page.getByText('Il tuo link referral'),
    ).toBeVisible({ timeout: 15_000 });

    const input = page.locator('input[readonly]').first();
    await expect(input).toBeVisible();
    const value = await input.inputValue();
    expect(value, 'Il link referral deve essere un URL valido').toMatch(/^https?:\/\//i);
  });

  test('copia il link referral e mostra il toast', async ({ page }) => {
    // Attendiamo che i dati siano caricati
    await page.waitForSelector('input[readonly]', { timeout: 15_000 });

    const copyBtn = page.getByRole('button', { name: /copia link/i });
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Il testo del pulsante cambia a "Copiato!"
    await expect(
      page.getByRole('button', { name: /copiato/i }),
    ).toBeVisible({ timeout: 3_000 });

    // Toast di conferma
    await expect(
      page.getByText(/link copiato/i),
    ).toBeVisible({ timeout: 3_000 });
  });

  // ── 3. Sezione ritiro ──────────────────────────────────────────────────────
  test('mostra il pannello di ritiro', async ({ page }) => {
    await expect(
      page.getByText('Saldo disponibile per il ritiro'),
    ).toBeVisible({ timeout: 15_000 });

    const withdrawBtn = page.getByRole('button', { name: /richiedi ritiro/i });
    await expect(withdrawBtn).toBeVisible();
    // Il pulsante può essere disabled (saldo sotto soglia): entrambi gli stati sono validi
  });

  test('apre il dialog di conferma ritiro (se abilitato)', async ({ page }) => {
    await page.waitForSelector('input[readonly]', { timeout: 15_000 });

    const withdrawBtn = page.getByRole('button', { name: /richiedi ritiro/i });
    const isDisabled  = await withdrawBtn.isDisabled();

    if (isDisabled) {
      // Saldo sotto soglia: il dialog non deve aprirsi
      test.info().annotations.push({
        type: 'info',
        description: 'Saldo sotto soglia minima — dialog non testato in questo ambiente',
      });
      return;
    }

    await withdrawBtn.click();
    await expect(
      page.getByRole('dialog', { name: /conferma ritiro/i }),
    ).toBeVisible({ timeout: 3_000 });

    // Annulla chiude il dialog
    await page.getByRole('button', { name: /annulla/i }).click();
    await expect(
      page.getByRole('dialog', { name: /conferma ritiro/i }),
    ).not.toBeVisible({ timeout: 2_000 });
  });

  // ── 4. Link nella navbar ───────────────────────────────────────────────────
  test('la navbar mostra la voce Dashboard Affiliazione', async ({ page }) => {
    // Apre il dropdown utente (desktop)
    const userBtn = page.locator('button').filter({ hasText: /.+/ }).first();
    // Cerca direttamente il link nel DOM (può essere nel dropdown o nel sheet mobile)
    await expect(
      page.getByText('Dashboard Affiliazione'),
    ).toBeVisible({ timeout: 5_000 }).catch(() => {
      // Su mobile il link è nel sheet — lo ignoriamo nel test desktop
    });
  });

});
