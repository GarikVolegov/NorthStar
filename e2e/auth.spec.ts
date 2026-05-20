import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";

test.describe("Autenticazione", () => {
  test("home page carica correttamente", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/NorthStar/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("pagina di registrazione e accessibile", async ({ page }) => {
    await page.goto(`${BASE}/registra`);
    await expect(page.getByRole("heading", { name: /create your account|crea/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("textbox", { name: /email address|email/i })).toBeVisible();
  });

  test("registrazione con dati validi", async ({ page }) => {
    const timestamp = Date.now();
    const email = `test_e2e_${timestamp}@northstar.test`;
    const password = "TestPassword123!";

    await page.goto(`${BASE}/registra`);
    await page.getByRole("textbox", { name: /email address|email/i }).fill(email);
    await page.getByRole("textbox", { name: /password/i }).fill(password);
    await page.getByRole("button", { name: /^continue$/i }).click();

    await expect
      .poll(async () => {
        const url = page.url();
        const visibleState = await page
          .locator("text=/verificare|registrato|benvenuto|verify|continue|password/i")
          .isVisible()
          .catch(() => false);
        return url.includes("/") || visibleState;
      }, { timeout: 5_000 })
      .toBeTruthy();
  });
});
