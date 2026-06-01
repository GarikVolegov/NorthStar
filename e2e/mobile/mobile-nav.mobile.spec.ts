/**
 * mobile-nav.mobile.spec.ts
 *
 * E2E della navigazione mobile corrente: top pill nav, tap target e overflow.
 */

import { expect, devices, test } from "@playwright/test";
import { projectBrowserDevice } from "../helpers/responsiveDevices";

test.use(projectBrowserDevice(devices["Pixel 5"]));

const BASE_URL = process.env.BASE_URL ?? "http://localhost:5173";

test.describe("Mobile Navigation - Pixel 5", () => {
  test("i link della nav mobile raggiungono le pagine principali", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const nav = page.getByRole("navigation", { name: /navigazione inferiore/i });
    await expect(nav).toBeVisible();

    const homeLink = nav.getByRole("link", { name: /home/i });
    await homeLink.tap();
    await expect(page).toHaveURL(`${BASE_URL}/`);

    const testLink = nav.getByRole("link", { name: /^test$/i });
    await testLink.tap();
    await expect(page).toHaveURL(/\/test/);
  });

  test("tap target mobile della nav sono almeno 44px", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

    const navLinks = page.getByRole("navigation", { name: /navigazione inferiore/i }).getByRole("link");
    const count = await navLinks.count();
    expect(count).toBeGreaterThanOrEqual(4);

    for (let index = 0; index < count; index += 1) {
      const box = await navLinks.nth(index).boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("nav mobile resta visibile dopo scroll", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "load" });

    await page.evaluate(() => window.scrollBy({ top: 500, behavior: "instant" }));

    const nav = page.getByRole("navigation", { name: /navigazione inferiore/i });
    await expect(nav).toBeVisible();
  });

  test("nessun overflow orizzontale sulla home", async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: "load" });

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );

    expect(hasHorizontalOverflow).toBe(false);
  });
});
