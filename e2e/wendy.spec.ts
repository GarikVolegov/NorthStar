import { test, expect } from '@playwright/test';
import { loginViaApi, waitForAuthReady } from './helpers/auth';

test.describe('Wendy nella barra di ricerca', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto('/');
    await waitForAuthReady(page);
  });

  test('Cmd K apre la stessa interfaccia integrata', async ({ page }) => {
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 10_000 });
  });

  test('risposta SSE mockata appare nel pannello search, senza finestra laterale', async ({ page }) => {
    await page.route('**/api/ai/wendy', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: [
          'data: {"type":"status","value":"Leggo il contesto..."}',
          '',
          'data: {"type":"token","value":"Ciao. Sono Wendy, qui nella search bar."}',
          '',
          'data: {"type":"done","intent":"simple_qa","requestId":"wendy-e2e"}',
          '',
        ].join('\n'),
      });
    });

    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();
    const input = page.getByRole('textbox').first();
    await input.fill('ciao');
    await input.press('Enter');

    await expect(page.getByText('ciao')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Sono Wendy, qui nella search bar/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="wendy-panel"]')).toHaveCount(0);
  });

  test('le API utente espongono i campi usati da Wendy', async ({ page }) => {
    const token = await page.evaluate(() => (
      sessionStorage.getItem('northstar_token') ??
      localStorage.getItem('northstar_token') ??
      localStorage.getItem('ns_token')
    ));
    expect(token, 'token JWT di test assente').toBeTruthy();

    const response = await page.request.get('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(Array.isArray(body.objectives), 'objectives deve essere un array').toBe(true);
    expect(body.sectorName === null || typeof body.sectorName === 'string').toBe(true);
    expect(typeof body.isPremium).toBe('boolean');
    expect(typeof body.isAffiliate).toBe('boolean');
  });
});
