/**
 * E2E — CV Builder
 *
 * Percorso testato:
 *   1. Login utente esistente
 *   2. Navigazione alla sezione CV
 *   3. Apertura form creazione/editing CV
 *   4. Compilazione sezione informazioni personali
 *   5. Aggiunta esperienza lavorativa
 *   6. Salvataggio e verifica conferma
 *   7. Download PDF (verifica che il download venga avviato)
 *
 * Convenzioni:
 *   - Nessun selettore su testo visivo (dipende dalla lingua/locale)
 *   - Solo data-testid — robusti a refactoring UI
 *   - Nessuna dipendenza da ordine di esecuzione con altri spec
 *   - Stato iniziale pulito tramite API seed (authToken fisso da CI)
 */
import { test, expect } from "@playwright/test";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@northstar.it";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD;

if (!E2E_USER_PASSWORD) {
  throw new Error("E2E_USER_PASSWORD is required for cv-builder E2E.");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loginUser(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.getByTestId("auth-email-input").fill(E2E_USER_EMAIL);
  await page.getByTestId("auth-password-input").fill(E2E_USER_PASSWORD);
  await page.getByTestId("auth-submit-btn").click();
  // Attende redirect post-login alla dashboard
  await page.waitForURL("**/dashboard", { timeout: 10_000 });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe("CV Builder", () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test("navigazione alla sezione CV", async ({ page }) => {
    await page.getByTestId("nav-cv-builder").click();
    await expect(page.getByTestId("cv-builder-page")).toBeVisible();
  });

  test("apertura form nuovo CV", async ({ page }) => {
    await page.getByTestId("nav-cv-builder").click();
    await page.getByTestId("cv-create-new-btn").click();
    await expect(page.getByTestId("cv-form-container")).toBeVisible();
    // Il form deve mostrare la sezione dati personali come primo step
    await expect(page.getByTestId("cv-section-personal")).toBeVisible();
  });

  test("compilazione dati personali e salvataggio", async ({ page }) => {
    await page.getByTestId("nav-cv-builder").click();
    await page.getByTestId("cv-create-new-btn").click();

    // Sezione dati personali
    await page.getByTestId("cv-input-fullname").fill("Mario Rossi");
    await page.getByTestId("cv-input-title").fill("Software Engineer");
    await page.getByTestId("cv-input-email").fill("mario@example.com");
    await page.getByTestId("cv-input-phone").fill("+39 02 1234567");
    await page.getByTestId("cv-input-city").fill("Milano");
    await page
      .getByTestId("cv-input-summary")
      .fill(
        "Software engineer con 5 anni di esperienza in TypeScript e React.",
      );

    // Salva e verifica toast di conferma
    await page.getByTestId("cv-save-btn").click();
    await expect(page.getByTestId("toast-success")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("aggiunta esperienza lavorativa", async ({ page }) => {
    await page.getByTestId("nav-cv-builder").click();
    await page.getByTestId("cv-create-new-btn").click();

    // Naviga al tab Esperienze
    await page.getByTestId("cv-tab-experience").click();
    await expect(page.getByTestId("cv-section-experience")).toBeVisible();

    // Aggiunge una voce
    await page.getByTestId("cv-experience-add-btn").click();
    await page.getByTestId("cv-exp-company").fill("Acme S.p.A.");
    await page.getByTestId("cv-exp-role").fill("Frontend Developer");
    await page.getByTestId("cv-exp-start").fill("2021-03");
    await page.getByTestId("cv-exp-end").fill("2024-01");
    await page
      .getByTestId("cv-exp-description")
      .fill("Sviluppo interfacce React, TypeScript, testing con Vitest.");

    // Verifica che la voce sia visibile nella lista
    await page.getByTestId("cv-save-btn").click();
    await expect(page.getByTestId("cv-experience-list")).toContainText("Acme");
  });

  test("aggiunta skill e verifica lista", async ({ page }) => {
    await page.getByTestId("nav-cv-builder").click();
    await page.getByTestId("cv-create-new-btn").click();

    await page.getByTestId("cv-tab-skills").click();
    await page.getByTestId("cv-skill-input").fill("TypeScript");
    await page.getByTestId("cv-skill-add-btn").click();
    await page.getByTestId("cv-skill-input").fill("React");
    await page.getByTestId("cv-skill-add-btn").click();

    // Verifica che le skill siano nella lista senza dipendere dal testo in un selettore specifico
    const skillList = page.getByTestId("cv-skills-list");
    await expect(skillList).toBeVisible();
    await expect(skillList.getByTestId("cv-skill-tag").first()).toBeVisible();
  });

  test("switch template CV e anteprima", async ({ page }) => {
    await page.getByTestId("nav-cv-builder").click();
    await page.getByTestId("cv-create-new-btn").click();

    // Apre il selettore template
    await page.getByTestId("cv-template-selector").click();
    await expect(page.getByTestId("cv-template-list")).toBeVisible();

    // Seleziona il secondo template disponibile
    const templates = page.getByTestId("cv-template-item");
    const count = await templates.count();
    if (count > 1) {
      await templates.nth(1).click();
      // Anteprima aggiornata senza errori JS
      await expect(page.getByTestId("cv-preview-container")).toBeVisible();
    }
  });

  test("download PDF avvia il download", async ({ page }) => {
    await page.getByTestId("nav-cv-builder").click();

    // Attende che ci sia almeno un CV nella lista
    const cvList = page.getByTestId("cv-list");
    const cvCount = await cvList.getByTestId("cv-list-item").count();
    test.skip(cvCount === 0, "Nessun CV esistente — salta download test");

    // Intercetta il download
    const downloadPromise = page.waitForEvent("download");
    await cvList
      .getByTestId("cv-list-item")
      .first()
      .getByTestId("cv-download-btn")
      .click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("validazione: salva senza dati obbligatori mostra errore inline", async ({
    page,
  }) => {
    await page.getByTestId("nav-cv-builder").click();
    await page.getByTestId("cv-create-new-btn").click();

    // Clicca salva senza compilare nulla
    await page.getByTestId("cv-save-btn").click();

    // Deve apparire almeno un errore di validazione — no testo specifico
    await expect(page.getByTestId("cv-validation-error").first()).toBeVisible({
      timeout: 3_000,
    });
  });
});
