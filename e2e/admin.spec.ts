import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";
const API_BASE = process.env.API_URL ?? "http://localhost:8080";

test.describe("Admin panel smoke", () => {
  test("admin home renders a protected admin surface", async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1, h2, main, body").first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test("admin status page renders", async ({ page }) => {
    await page.goto(`${BASE}/admin/status`);
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin metrics require authenticated admin access", async ({
    request,
  }) => {
    const response = await request.get(`${API_BASE}/api/admin/metrics`);
    expect([401, 403]).toContain(response.status());
  });

  test("admin ops status requires authenticated admin access", async ({
    request,
  }) => {
    const response = await request.get(`${API_BASE}/api/admin/ops/status`);
    expect([401, 403]).toContain(response.status());
  });
});
