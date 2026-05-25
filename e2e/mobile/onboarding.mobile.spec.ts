/**
 * onboarding.mobile.spec.ts
 *
 * Smoke E2E del primo impatto mobile su Pixel 5 e iPhone 12.
 */

import { expect, devices, test } from "@playwright/test";

const MOBILE_DEVICES = [
  { name: "Pixel 5", device: devices["Pixel 5"] },
  { name: "iPhone 12", device: devices["iPhone 12"] },
];

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

function mobileUse(device: typeof devices["Pixel 5"]) {
  const { defaultBrowserType: _defaultBrowserType, ...use } = device;
  return use;
}

for (const { name, device } of MOBILE_DEVICES) {
  test.describe(`Onboarding mobile - ${name}`, () => {
    test.use(mobileUse(device));

    test("home page carica e mostra CTA principale", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

      await expect(page.getByText(/NorthStar/i).first()).toBeVisible();

      const primaryCta = page
        .getByRole("link", { name: /start the free test|inizia/i })
        .first();
      await expect(primaryCta).toBeVisible();

      const box = await primaryCta.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    });

    test("navigazione mobile verso /test", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

      await page.getByRole("navigation", { name: /navigazione inferiore/i }).getByRole("link", { name: /^test$/i }).tap();
      await expect(page).toHaveURL(/\/test/);
    });

    test("la nav mobile ha tap target accessibili", async ({ page }) => {
      await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

      const bottomNav = page.getByRole("navigation", { name: /navigazione inferiore/i });
      await expect(bottomNav).toBeVisible();

      const navLinks = bottomNav.getByRole("link");
      const count = await navLinks.count();
      expect(count).toBeGreaterThanOrEqual(4);

      for (let index = 0; index < Math.min(count, 5); index += 1) {
        const box = await navLinks.nth(index).boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
    });
  });
}
