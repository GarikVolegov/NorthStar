import { test, expect, type Page } from '@playwright/test';
import { registerE2eUser } from './helpers/auth';
import { responseJson } from './helpers/json';

type AuthMeResponse = {
  id: number;
  email: string;
  journeyType: string | null;
  isAffiliate: boolean;
};

type DashboardResponse = {
  user: {
    isPremium: boolean;
  };
  objectives: unknown[];
};

function searchInput(page: Page) {
  return page.getByRole('combobox').or(page.getByRole('textbox')).first();
}

test.describe('Wendy nella barra di ricerca', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('Cmd K apre la stessa interfaccia integrata', async ({ page }) => {
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await page.keyboard.press('k');
    await page.keyboard.up(modifier);
    await expect(searchInput(page)).toBeVisible({ timeout: 10_000 });
  });

  test('risposta SSE mockata mostra token e done nel pannello search senza duplicati', async ({ page }) => {
    let wendyRequests = 0;
    await page.route('**/api/ai/wendy', async (route) => {
      wendyRequests += 1;
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: [
          'data: {"type":"status","value":"Leggo il contesto..."}',
          '',
          'data: {"type":"token","value":"Ciao. Sono Wendy, qui nella search bar."}',
          '',
          'data: {"type":"done","requestId":"wendy-e2e","contextSources":["app-data"],"answerMode":"local-fast-path","suggestedPrompts":[{"label":"Continua il check","prompt":"Continua il check con Wendy"}]}',
          '',
        ].join('\n'),
      });
    });

    await page.getByRole('button', { name: /apri ricerca wendy/i }).click();
    const input = searchInput(page);
    await input.fill('ciao');
    await page.getByRole('button', { name: /Chiedi a Wendy di guidarti su "ciao"/i }).click();

    await expect(page.getByText('ciao', { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/Sono Wendy, qui nella search bar/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Continua il check' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('region', { name: 'Chat Wendy' })).toHaveCount(1);
    expect(wendyRequests).toBe(1);
    await expect(page.locator('[data-testid="wendy-panel"]')).toHaveCount(0);
  });

  test('le API utente espongono profilo e dashboard usati da Wendy', async ({ page }) => {
    const headers = await registerE2eUser(page.request, 'wendy-e2e');

    const response = await page.request.get('/api/auth/me', {
      headers,
    });
    expect(response.status()).toBe(200);
    const body = await responseJson<AuthMeResponse>(response);

    expect(typeof body.id).toBe('number');
    expect(typeof body.email).toBe('string');
    expect(body.journeyType === null || typeof body.journeyType === 'string').toBe(true);
    expect(typeof body.isAffiliate).toBe('boolean');

    const dashboardResponse = await page.request.get('/api/dashboard', { headers });
    expect(dashboardResponse.status()).toBe(200);
    const dashboard = await responseJson<DashboardResponse>(dashboardResponse);
    expect(Array.isArray(dashboard.objectives), 'dashboard objectives deve essere un array').toBe(true);
    expect(typeof dashboard.user.isPremium).toBe('boolean');
  });
});
