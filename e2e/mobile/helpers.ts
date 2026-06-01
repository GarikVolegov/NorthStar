import { expect, type Locator, type Page } from "@playwright/test";

export function useDeviceWithoutBrowser<T extends { defaultBrowserType?: unknown }>(device: T): Omit<T, "defaultBrowserType"> {
  const { defaultBrowserType: _defaultBrowserType, ...use } = device;
  return use;
}

export async function expectNoHorizontalOverflow(page: Page) {
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

export async function expectReachableInViewport(locator: Locator, label: string) {
  await expect(locator, label).toBeVisible({ timeout: 15_000 });
  const box = await locator.boundingBox();
  expect(box, `${label} deve avere un bounding box`).not.toBeNull();
  const viewport = locator.page().viewportSize();
  expect(viewport, "Il viewport Playwright deve essere definito").not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x + box.width, `${label} non deve uscire a destra`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.x, `${label} non deve uscire a sinistra`).toBeGreaterThanOrEqual(-1);
  expect(box.y + Math.min(box.height, 44), `${label} deve avere almeno il tap target iniziale visibile`).toBeLessThanOrEqual(viewport.height + 1);
}

export async function expectTapTarget(locator: Locator, label: string) {
  await expect(locator, label).toBeVisible({ timeout: 15_000 });
  const box = await locator.boundingBox();
  expect(box, `${label} deve avere un bounding box`).not.toBeNull();
  if (!box) return;

  expect(box.height, `${label} deve essere alto almeno 44px`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} deve essere largo almeno 44px`).toBeGreaterThanOrEqual(44);
}
