import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";
const API_BASE = process.env.API_URL ?? "http://localhost:8080";

test.describe("API Obiettivi (no auth)", () => {
  test("GET /api/objectives senza auth ritorna 401", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/objectives`);
    expect(response.status()).toBe(401);
  });
});

test.describe("Pagine principali accessibili", () => {
  test("home page si carica", async ({ page }) => {
    await page.goto(BASE);
    await expect(page).toHaveTitle(/NorthStar/i);
  });

  test("pagina settori risponde", async ({ page }) => {
    await page.goto(`${BASE}/settori`);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 10000 });
  });

  test("pagina news risponde", async ({ page }) => {
    await page.goto(`${BASE}/news`);
    await expect(page.locator("body")).toBeVisible();
  });

  test("pagina profilo reindirizza se non autenticato", async ({ page }) => {
    await page.goto(`${BASE}/profilo`);
    await expect
      .poll(async () => {
        const url = page.url();
        const isHome = url === BASE || url === `${BASE}/` || url.endsWith("/");
        const hasLoginPrompt = await page.locator("text=/accedi|login|registr/i").isVisible().catch(() => false);
        return isHome || hasLoginPrompt;
      }, { timeout: 5_000 })
      .toBeTruthy();
  });

  test("dashboard reindirizza se non autenticato", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect
      .poll(async () => {
        const url = page.url();
        const isHome = url === BASE || url === `${BASE}/` || url.endsWith("/");
        const hasLoginPrompt = await page.locator("text=/accedi|login|registr/i").isVisible().catch(() => false);
        return isHome || hasLoginPrompt;
      }, { timeout: 5_000 })
      .toBeTruthy();
  });
});

test.describe("API Pubblica", () => {
  test("GET /api/sectors restituisce lista settori", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/sectors`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("id");
      expect(body[0]).toHaveProperty("name");
    }
  });

  test("GET /api/news restituisce articoli o array vuoto", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/news`);
    expect([200, 404]).toContain(response.status());
    if (response.status() === 200) {
      const body = await response.json();
      expect(Array.isArray(body) || typeof body === "object").toBeTruthy();
    }
  });
});
