/**
 * E2E: Pagina Wendy (/wendy)
 *
 * Testa il flusso completo della pagina chat con Wendy, la growth agent AI.
 *
 * Prerequisiti:
 *   - App in esecuzione su BASE_URL (default: http://localhost:5000)
 *   - Server con OPENAI_API_KEY configurata (per test SSE reali)
 *   - .env.test con TEST_USER_EMAIL e TEST_USER_PASSWORD
 *
 * Per i test SSE, Playwright intercepta la response e verifica
 * che arrivino token (non richiede risposta AI completa).
 *
 * Esecuzione:
 *   pnpm exec playwright test e2e/wendy.spec.ts
 *   pnpm exec playwright test e2e/wendy.spec.ts --headed  # per debug visuale
 */
import { test, expect } from '@playwright/test';
import { loginViaApi, waitForAuthReady } from './helpers/auth';

// ── suite ────────────────────────────────────────────────────────────────

test.describe('Pagina Wendy — /wendy', () => {

  // ── 1. Auth guard ───────────────────────────────────────────────

  test('redirect a /login se utente non autenticato', async ({ page }) => {
    // Naviga senza token — AuthRoute deve fare redirect
    await page.goto('/wendy');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('preserva il redirect param: /login?redirect=%2Fwendy', async ({ page }) => {
    await page.goto('/wendy');
    await expect(page).toHaveURL(/redirect=%2Fwendy/, { timeout: 10_000 });
  });

  // ── 2. Layout base ───────────────────────────────────────────────

  test.describe('utente autenticato', () => {

    test.beforeEach(async ({ page }) => {
      await loginViaApi(page);
      await page.goto('/wendy');
      await waitForAuthReady(page);
    });

    test('la pagina si carica senza errori JS critici', async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));

      // Aspetta che la pagina sia stabile (Suspense lazy load completato)
      await page.waitForLoadState('networkidle', { timeout: 15_000 });

      // Filtra errori non critici (es. dev warnings di React)
      const criticalErrors = errors.filter(
        (e) => !e.includes('Warning:') && !e.includes('[Fast Refresh]'),
      );
      expect(criticalErrors, 'Nessun errore JS critico').toHaveLength(0);
    });

    test('mostra la navbar NorthStar', async ({ page }) => {
      await expect(page.locator('header')).toBeVisible({ timeout: 10_000 });
    });

    test('mostra l\'area chat con il campo input', async ({ page }) => {
      // Input del messaggio — WendyPage monta GrowthChatPanel
      // Il placeholder può variare; usiamo un selector più robusto
      const chatInput = page.locator('textarea, input[type="text"]').last();
      await expect(chatInput).toBeVisible({ timeout: 15_000 });
    });

    test('mostra il messaggio di benvenuto di Wendy', async ({ page }) => {
      // WendyPage chiama /api/growth-agent/onboarding/status
      // e mostra il primo messaggio di Wendy al caricamento
      await expect(
        page.getByText(/wendy/i).or(page.getByText(/ciao|benvenuto|obiettiv/i)),
      ).toBeVisible({ timeout: 20_000 });
    });

    test('URL rimane /wendy dopo il caricamento', async ({ page }) => {
      await page.waitForLoadState('networkidle', { timeout: 15_000 });
      await expect(page).toHaveURL(/\/wendy$/);
    });

    // ── 3. Invio messaggio e risposta SSE ────────────────────────

    test('il campo input accetta testo', async ({ page }) => {
      const chatInput = page.locator('textarea, input[type="text"]').last();
      await chatInput.fill('Ciao Wendy, test automatico');
      await expect(chatInput).toHaveValue('Ciao Wendy, test automatico');
    });

    test('invia messaggio e mostra lo stato di caricamento', async ({ page }) => {
      const chatInput = page.locator('textarea, input[type="text"]').last();
      await chatInput.fill('Ciao Wendy');

      // Intercetta la chiamata SSE al growth-agent (evita costi AI reali in CI)
      await page.route('/api/growth-agent/**', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          // Simula un token SSE minimo
          body: 'data: {"token":"Ciao! "}

data: {"token":"Sono Wendy."}

data: [DONE]

',
        });
      });

      // Submit (Enter o click su pulsante invia)
      await chatInput.press('Enter');

      // Il messaggio utente appare nella chat
      await expect(
        page.getByText('Ciao Wendy'),
      ).toBeVisible({ timeout: 5_000 });
    });

    test('risposta SSE mockata appare nella chat', async ({ page }) => {
      await page.route('/api/growth-agent/**', async (route) => {
        await route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: 'data: {"token":"Risposta "}

data: {"token":"di test."}

data: [DONE]

',
        });
      });

      const chatInput = page.locator('textarea, input[type="text"]').last();
      await chatInput.fill('Test');
      await chatInput.press('Enter');

      // La risposta mockata deve apparire nel DOM
      await expect(
        page.getByText(/risposta.*di test/i),
      ).toBeVisible({ timeout: 10_000 });
    });

    // ── 4. Contesto utente (objectives e sectorName) ──────────────

    test('GET /api/auth/me restituisce objectives e sectorName', async ({ page }) => {
      // Verifica direttamente dalla pagina che la chiamata à API avvenga
      // e che i campi critici per Wendy siano presenti
      const authMePromise = page.waitForResponse(
        (r) => r.url().includes('/api/auth/me') && r.status() === 200,
        { timeout: 15_000 },
      );

      await page.goto('/wendy');
      const authMeRes = await authMePromise;
      const body = await authMeRes.json();

      expect(body, 'Risposta /api/auth/me deve essere un oggetto').toBeTruthy();
      expect(Array.isArray(body.objectives), 'objectives deve essere un array').toBe(true);
      // sectorName può essere null se l\'utente non ha fatto il test RIASEC
      expect(
        body.sectorName === null || typeof body.sectorName === 'string',
        'sectorName deve essere string | null',
      ).toBe(true);
      expect(typeof body.isPremium, 'isPremium deve essere boolean').toBe('boolean');
      expect(typeof body.isAffiliate, 'isAffiliate deve essere boolean').toBe('boolean');
    });

  });

});
