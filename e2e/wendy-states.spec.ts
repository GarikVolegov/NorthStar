import { test, expect, type Page } from '@playwright/test';

function searchInput(page: Page) {
  return page.getByRole('combobox').or(page.getByRole('textbox')).first();
}

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

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('la vecchia finestra laterale non viene montata', async ({ page }) => {
    await expect(page.locator('[data-testid="wendy-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="wendy-fab"]')).toHaveCount(0);
  });

  test('il bottone della navbar apre il composer unico', async ({ page }) => {
    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();
    await expect(searchInput(page)).toBeVisible({ timeout: 10_000 });
  });

  test('invia un messaggio e mostra la risposta nello stesso pannello search', async ({ page }) => {
    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();

    const input = searchInput(page);
    await input.fill('chi sei?');
    await page.getByRole('button', { name: 'Chiedi a Wendy di guidarti su "chi sei?"' }).click();

    await expect(page.getByText('chi sei?', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Sono Wendy nella barra di ricerca/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('[data-testid="wendy-panel"]')).toHaveCount(0);
  });
});

test.describe('Wendy guest e stati ricerca globale', () => {
  test('guest vede un gate auth leggibile dentro Wendy, non un errore tecnico', async ({ page }) => {
    await page.route('**/api/ai/wendy', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: [
          'data: {"type":"gate","feature":"auth_required","authRequired":true,"loginUrl":"/sign-in","message":"Accedi per parlare con Wendy e salvare il tuo percorso."}',
          '',
        ].join('\n'),
      });
    });

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();
    const input = searchInput(page);
    await input.fill('aiutami con il percorso');
    await page.getByRole('button', { name: /Chiedi a Wendy di guidarti su "aiutami con il percorso"/i }).click();

    await expect(page.getByText('Accedi per parlare con Wendy e salvare il tuo percorso.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/WENDY_GATE|SSE_|JSON|undefined|stack/i)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Chat Wendy' })).toHaveCount(1);
    await expect(page.locator('[data-testid="wendy-panel"]')).toHaveCount(0);
  });

  test('mostra empty state ricerca globale e mantiene Wendy come azione utile', async ({ page }) => {
    await page.route('**/api/search/hybrid', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], has_semantic: false, searchMode: 'keyword', indexStatus: 'ready' }),
      });
    });
    await page.route('**/api/search/suggest**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestions: [] }),
      });
    });

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();
    await searchInput(page).fill('zzzz');

    await expect(page.getByText('Nessun risultato globale per "zzzz"')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Chiedi a Wendy di guidarti su "zzzz"/i })).toBeVisible();
  });

  test('mostra error state ricerca globale senza bloccare il passaggio a Wendy', async ({ page }) => {
    await page.route('**/api/search/hybrid', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'search unavailable in e2e' }),
      });
    });
    await page.route('**/api/search/suggest**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestions: [] }),
      });
    });

    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();
    await searchInput(page).fill('design');

    await expect(page.getByText('La ricerca globale non e disponibile adesso.')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Chiedi a Wendy di guidarti su "design"/i })).toBeVisible();
  });
});
