import { test, expect } from "@playwright/test";
import { loginViaApi } from "./helpers/auth";

test.describe("Dashboard affiliazioni C2C autenticata", () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/affiliazione/dashboard");
  });

  test("utente autenticato vede dashboard, link personale e QR", async ({
    page,
  }) => {
    await expect(page.getByText("Guadagnato totale")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Riserva primo mese")).toBeVisible();
    await expect(page.getByText("Disponibile")).toBeVisible();

    await expect(page.getByText("Link personale")).toBeVisible();
    const input = page.locator("input[readonly]").first();
    await expect(input).toBeVisible();
    const value = await input.inputValue();
    expect(value).toMatch(/^https?:\/\/.+\/sign-up\?ref=/i);

    await expect(page.getByRole("img", { name: /qr|referral/i })).toBeVisible();
  });

  test("copia il link referral", async ({ page }) => {
    await page.waitForSelector("input[readonly]", { timeout: 15_000 });

    const copyBtn = page.getByRole("button", { name: /copia/i }).first();
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    await expect(page.getByText(/copiato|link copiato/i)).toBeVisible({
      timeout: 3_000,
    });
  });
});

test.describe("Dashboard affiliazioni C2C pubblica", () => {
  test("utente non autenticato viene mandato al login", async ({ page }) => {
    await page.goto("/affiliazione/dashboard");
    await expect(page).toHaveURL(/sign-in|login|registra|accedi/i, {
      timeout: 8_000,
    });
  });
});
