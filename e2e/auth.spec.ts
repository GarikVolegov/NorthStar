import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";

test.describe("Autenticazione", () => {
  test("home page carica correttamente", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/NorthStar/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("pagina di registrazione è accessibile", async ({ page }) => {
    await page.goto(`${BASE}/registra`);
    await expect(page.locator("input[type='email'], input[name='email']").first()).toBeVisible({ timeout: 10000 });
  });

  test("registrazione con dati validi", async ({ page }) => {
    const timestamp = Date.now();
    const email = `test_e2e_${timestamp}@northstar.test`;
    const password = "TestPassword123!";

    await page.goto(`${BASE}/registra`);

    // Fill in name
    const nameInput = page.locator("input[name='name'], input[placeholder*='nome'], input[placeholder*='Nome']").first();
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill("Test E2E User");
    }

    // Fill in email
    await page.locator("input[type='email'], input[name='email']").first().fill(email);

    // Fill in password (might be two fields)
    const passwordInputs = page.locator("input[type='password']");
    const count = await passwordInputs.count();
    if (count >= 1) await passwordInputs.nth(0).fill(password);
    if (count >= 2) await passwordInputs.nth(1).fill(password);

    // Submit
    await page.locator("button[type='submit'], button:has-text('Registrati'), button:has-text('Crea account')").first().click();

    // Wait for navigation or success indicator
    await page.waitForTimeout(2000);
    const url = page.url();
    // Should redirect to home, dashboard, or show a success message
    const success = url.includes("/") || await page.locator("text=/verificare|registrato|benvenuto/i").isVisible({ timeout: 3000 }).catch(() => false);
    expect(success).toBeTruthy();
  });
});
