/**
 * Mobile E2E coverage for the private affiliate dashboard.
 *
 * Uses loginViaApi so local runs can fall back to a unique E2E user instead of
 * depending on a pre-seeded affiliate account.
 */

import { expect, devices, test, type Locator, type Page } from "@playwright/test";
import { loginViaApi, waitForAuthReady } from "../helpers/auth";

test.use({ ...devices["Pixel 5"] });

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    return {
      scrollWidth,
      clientWidth: doc.clientWidth,
      overflowBy: scrollWidth - doc.clientWidth,
    };
  });

  expect(overflow.overflowBy, JSON.stringify(overflow)).toBeLessThanOrEqual(1);
}

async function expectTapTarget(locator: Locator, label: string) {
  await expect(locator, label).toBeVisible({ timeout: 15_000 });
  const box = await locator.boundingBox();
  expect(box, `${label} deve avere un bounding box`).not.toBeNull();
  if (!box) return;

  expect(box.height, `${label} deve essere alto almeno 44px`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} deve essere largo almeno 44px`).toBeGreaterThanOrEqual(44);
}

test.describe("Affiliate dashboard mobile - Pixel 5", () => {
  test("mostra link referral, azioni principali e nessun overflow", async ({ page }) => {
    await loginViaApi(page);
    await page.goto("/affiliate", { waitUntil: "domcontentloaded" });
    await waitForAuthReady(page);

    await expect(page.getByRole("heading", { name: /invita amici/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/link personale/i)).toBeVisible({ timeout: 15_000 });

    const referralInput = page.locator("input[readonly]").first();
    await expect(referralInput).toBeVisible({ timeout: 20_000 });
    const referralLink = await referralInput.inputValue();
    expect(referralLink).toMatch(/^https?:\/\/.+\/sign-up\?ref=/i);

    await expectTapTarget(page.getByRole("button", { name: /^copia$/i }), "bottone copia link");
    await expectTapTarget(page.getByRole("button", { name: /whatsapp/i }), "bottone WhatsApp");
    await expectTapTarget(page.getByRole("button", { name: /^email$/i }), "bottone Email");
    await expectTapTarget(page.getByRole("button", { name: /condividi/i }), "bottone condividi");
    await expectTapTarget(page.getByRole("button", { name: /scarica QR/i }), "bottone scarica QR");

    await expect(page.getByText(/saldo disponibile per il ritiro/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
