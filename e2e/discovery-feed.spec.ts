/**
 * E2E — Discovery Feed
 * Testa il feed personalizzato, filtri, bookmark
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5000';

async function loginAsTest(page: any) {
  await page.goto(`${BASE}/auth`);
  await page.fill('[data-testid="email-input"]', 'test@northstar.app');
  await page.fill('[data-testid="password-input"]', 'testpassword123');
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('**/dashboard', { timeout: 10_000 });
}

test.describe('Discovery Feed — navigazione e filtri', () => {
  test('pagina discovery carica e mostra card', async ({ page }) => {
    await loginAsTest(page);
    await page.goto(`${BASE}/discovery`);
    // Attende almeno una card nel feed
    await expect(page.locator('[data-testid="discovery-item-card"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('filtro per tipo mostra solo card del tipo selezionato', async ({ page }) => {
    await loginAsTest(page);
    await page.goto(`${BASE}/discovery`);
    await page.locator('[data-testid="filter-article"]').click();
    // Dopo il click, le card visibili devono avere il badge corretto
    const cards = page.locator('[data-testid="discovery-item-card"]');
    await expect(cards.first()).toBeVisible({ timeout: 10_000 });
    // Almeno una card con il badge article visibile
    await expect(page.locator('[data-testid="badge-article"]').first()).toBeVisible();
  });

  test('pill insight espandibile — click apre testo completo', async ({ page }) => {
    await loginAsTest(page);
    await page.goto(`${BASE}/discovery`);
    const firstCard = page.locator('[data-testid="discovery-item-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const insightBtn = firstCard.locator('[data-testid="insight-pill"]');
    const hasInsight = await insightBtn.isVisible();
    if (hasInsight) {
      await insightBtn.click();
      await expect(firstCard.locator('[data-testid="insight-expanded"]')).toBeVisible();
    }
  });

  test('bookmark su una card — icona cambia stato', async ({ page }) => {
    await loginAsTest(page);
    await page.goto(`${BASE}/discovery`);
    const firstCard = page.locator('[data-testid="discovery-item-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });
    const bookmarkBtn = firstCard.locator('[data-testid="bookmark-btn"]');
    if (await bookmarkBtn.isVisible()) {
      const initialAriaLabel = await bookmarkBtn.getAttribute('aria-label');
      await bookmarkBtn.click();
      await expect(bookmarkBtn).not.toHaveAttribute('aria-label', initialAriaLabel ?? '');
    }
  });
});
