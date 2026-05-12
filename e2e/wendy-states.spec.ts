import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Wendy UI states', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('floating button is visible on dashboard', async ({ page }) => {
    const fab = page.locator('[data-testid="wendy-fab"]');
    await expect(fab).toBeVisible();
  });

  test('clicking FAB opens Wendy panel', async ({ page }) => {
    await page.locator('[data-testid="wendy-fab"]').click();
    const panel = page.locator('[data-testid="wendy-panel"]');
    await expect(panel).toBeVisible();
  });

  test('avatar shows idle state initially', async ({ page }) => {
    await page.locator('[data-testid="wendy-fab"]').click();
    const avatar = page.locator('[data-testid="wendy-avatar"]');
    await expect(avatar).toBeVisible();
    // Avatar should have idle/curious state by default
    await expect(avatar).toHaveAttribute('data-state', /idle|curious/);
  });

  test('sending a message shows thinking state then response', async ({ page }) => {
    await page.locator('[data-testid="wendy-fab"]').click();

    const input = page.locator('[data-testid="wendy-chat-input"]');
    await expect(input).toBeVisible();

    await input.fill('Ciao, come stai?');
    await page.locator('[data-testid="wendy-send-btn"]').click();

    // Should show thinking indicator
    const thinking = page.locator('[data-testid="wendy-thinking"]');
    await expect(thinking).toBeVisible({ timeout: 5000 });

    // Should receive a response (mock AI)
    const assistantMsg = page.locator('[data-testid="wendy-message-assistant"]').first();
    await expect(assistantMsg).toBeVisible({ timeout: 15000 });
    await expect(assistantMsg).not.toHaveText('');

    // Thinking should be gone
    await expect(thinking).not.toBeVisible({ timeout: 5000 });
  });

  test('wendy panel close button works', async ({ page }) => {
    await page.locator('[data-testid="wendy-fab"]').click();
    await expect(page.locator('[data-testid="wendy-panel"]')).toBeVisible();

    await page.locator('[data-testid="wendy-close-btn"]').click();
    await expect(page.locator('[data-testid="wendy-panel"]')).not.toBeVisible();
  });

  test('wendy is accessible from multiple pages', async ({ page }) => {
    // Dashboard
    await page.goto('/');
    await expect(page.locator('[data-testid="wendy-fab"]')).toBeVisible();

    // Results page
    await page.goto('/risultati/1');
    await expect(page.locator('[data-testid="wendy-fab"]')).toBeVisible();

    // Trading/Archivio page
    await page.goto('/archivio');
    await expect(page.locator('[data-testid="wendy-fab"]')).toBeVisible();
  });
});
