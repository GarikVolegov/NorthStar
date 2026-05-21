import { test, expect } from "@playwright/test";
import { responseJson } from "./helpers/json";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";

test.describe("Test RIASEC", () => {
  test("pagina test è accessibile", async ({ page }) => {
    await page.goto(`${BASE}/test`);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByRole("button", { name: /inizia il percorso|inizia/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test("pagina settori è accessibile", async ({ page }) => {
    await page.goto(`${BASE}/settori`);
    await expect(page.locator("body")).toBeVisible();
    // Should show a list of sectors
    await expect(page.locator("h1, h2").first()).toBeVisible({
      timeout: 10000,
    });
  });

  test("API health live risponde correttamente", async ({ request }) => {
    const apiBase = process.env.API_URL ?? "http://localhost:8080";
    const response = await request.get(`${apiBase}/api/health/live`);
    expect(response.status()).toBe(200);
    const body = await responseJson<{ status: string }>(response);
    expect(body.status).toBe("alive");
  });

  test("API /api/health restituisce stato base", async ({ request }) => {
    const apiBase = process.env.API_URL ?? "http://localhost:8080";
    const response = await request.get(`${apiBase}/api/health`);
    expect(response.status()).toBe(200);
    const body = await responseJson<{ status: string }>(response);
    expect(body.status).toBe("ok");
  });
});
