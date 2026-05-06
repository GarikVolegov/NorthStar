import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";

test.describe("Test RIASEC", () => {
  test("pagina test è accessibile", async ({ page }) => {
    await page.goto(`${BASE}/test`);
    await expect(page.locator("body")).toBeVisible();
    // Should show test questions or a start button
    const hasContent = await page.locator("text=/domanda|inizia|test|riasec/i").isVisible({ timeout: 10000 }).catch(() => false);
    expect(hasContent).toBeTruthy();
  });

  test("pagina settori è accessibile", async ({ page }) => {
    await page.goto(`${BASE}/settori`);
    await expect(page.locator("body")).toBeVisible();
    // Should show a list of sectors
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("API health risponde correttamente", async ({ request }) => {
    const apiBase = process.env.API_URL ?? "http://localhost:8080";
    const response = await request.get(`${apiBase}/api/healthz`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("API /api/health restituisce stato sistema", async ({ request }) => {
    const apiBase = process.env.API_URL ?? "http://localhost:8080";
    const response = await request.get(`${apiBase}/api/health`);
    // Accept 200 or 503 (degraded)
    expect([200, 503]).toContain(response.status());
    const body = await response.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("services");
    expect(body).toHaveProperty("env");
  });
});
