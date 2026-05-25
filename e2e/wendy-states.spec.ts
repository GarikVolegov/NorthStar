import { test, expect } from '@playwright/test';
import { loginViaApi, waitForAuthReady } from './helpers/auth';

test.describe('Wendy integrata nella search bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/ai/wendy', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: [
          'data: {"type":"status","value":"Ci sono."}',
          '',
          'data: {"type":"token","value":"Sono Wendy nella barra di ricerca."}',
          '',
          'data: {"type":"done","intent":"simple_qa","requestId":"e2e"}',
          '',
        ].join('\n'),
      });
    });

    await loginViaApi(page);
    await page.goto('/');
    await waitForAuthReady(page);
    await expect(page.locator('body')).toBeVisible();
  });

  test('la vecchia finestra laterale non viene montata', async ({ page }) => {
    await expect(page.locator('[data-testid="wendy-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="wendy-fab"]')).toHaveCount(0);
  });

  test('il bottone della navbar apre il composer unico', async ({ page }) => {
    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 10_000 });
  });

  test('invia un messaggio e mostra la risposta nello stesso pannello search', async ({ page }) => {
    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();

    const input = page.getByRole('textbox').first();
    await input.fill('chi sei?');
    await input.press('Enter');

    await expect(page.getByText('chi sei?')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Sono Wendy nella barra di ricerca/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="wendy-panel"]')).toHaveCount(0);
  });
});
