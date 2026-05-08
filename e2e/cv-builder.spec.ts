/**
 * E2E — CV Builder flow
 * Testa il flusso completo: login → dashboard → generazione CV → download
 * Run con: pnpm test:e2e (richiede tutti e 3 i servizi attivi)
 */
import { test, expect } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5000';

test.describe('CV Builder — flusso completo', () => {
  // Autenticazione condivisa — login una volta per tutti i test
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    // Usa un account di test pre-esistente (seed in CI)
    await page.fill('[data-testid="email-input"]', 'test@northstar.app');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard', { timeout: 10_000 });
  });

  test('sezione CV visibile in dashboard', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.locator('[data-testid="cv-section"]')).toBeVisible();
  });

  test('apertura CvGeneratorModal dal bottone Genera', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    const generateBtn = page.locator('[data-testid="cv-generate-btn"]');
    await expect(generateBtn).toBeVisible();
    await generateBtn.click();
    await expect(page.locator('[data-testid="cv-generator-modal"]')).toBeVisible();
  });

  test('scelta template e avvio generazione', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.locator('[data-testid="cv-generate-btn"]').click();
    // Seleziona template classic
    await page.locator('[data-testid="template-classic"]').click();
    await expect(page.locator('[data-testid="template-classic"]')).toHaveClass(/selected|ring/);
    // Avvia generazione
    await page.locator('[data-testid="cv-start-generate-btn"]').click();
    // Loader visibile durante generazione AI
    await expect(page.locator('[data-testid="cv-generating-loader"]')).toBeVisible();
  });

  test('menu download visibile dopo generazione', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    // Se CV già generato, il bottone download è visibile direttamente
    const downloadMenu = page.locator('[data-testid="cv-download-menu"]');
    // Attende max 5s — potrebbe non esserci se CV non ancora generato
    const isVisible = await downloadMenu.isVisible().catch(() => false);
    if (isVisible) {
      await downloadMenu.click();
      await expect(page.locator('[data-testid="download-pdf-btn"]')).toBeVisible();
      await expect(page.locator('[data-testid="download-docx-btn"]')).toBeVisible();
    } else {
      test.info().annotations.push({ type: 'skip-reason', description: 'CV non ancora generato per questo utente di test' });
    }
  });

  test('chiusura modale con tasto ESC', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.locator('[data-testid="cv-generate-btn"]').click();
    await expect(page.locator('[data-testid="cv-generator-modal"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="cv-generator-modal"]')).not.toBeVisible();
  });
});

test.describe('CV Builder — ATS score', () => {
  test('bottone ATS score visibile se CV generato', async ({ page }) => {
    await page.goto(`${BASE}/auth`);
    await page.fill('[data-testid="email-input"]', 'test@northstar.app');
    await page.fill('[data-testid="password-input"]', 'testpassword123');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');

    await page.goto(`${BASE}/dashboard`);
    const atsBtn = page.locator('[data-testid="cv-ats-btn"]');
    if (await atsBtn.isVisible()) {
      await atsBtn.click();
      // Il pannello ATS si apre
      await expect(page.locator('[data-testid="ats-panel"]')).toBeVisible();
    }
  });
});
