import { test, expect } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";
const API_BASE = process.env.API_URL ?? "http://localhost:8080";
const ADMIN_KEY = process.env.ADMIN_KEY ?? "northstar-admin";

test.describe("Admin Panel", () => {
  test("admin home è accessibile", async ({ page }) => {
    await page.goto(`${BASE}/admin`);
    // Should show the admin key input or the admin panel
    await expect(page.locator("body")).toBeVisible();
    const hasAdminContent = await page.locator("input[type='password'], h1:has-text('Admin'), h1:has-text('NorthStar')").first().isVisible({ timeout: 8000 }).catch(() => false);
    expect(hasAdminContent).toBeTruthy();
  });

  test("admin status page è accessibile", async ({ page }) => {
    await page.goto(`${BASE}/admin/status`);
    await expect(page.locator("body")).toBeVisible();
  });

  test("API admin/metrics richiede autenticazione", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/admin/metrics`);
    expect(response.status()).toBe(401);
  });

  test("API admin/metrics risponde con chiave valida", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/admin/metrics`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("users");
    expect(body).toHaveProperty("tests");
  });

  test("API admin/agent-health risponde con chiave valida", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/admin/agent-health`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("agents");
    expect(body).toHaveProperty("daily");
  });

  test("API admin/growth-queue risponde con chiave valida", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/admin/growth-queue`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("queue");
    expect(body).toHaveProperty("stats");
  });

  test("API admin/catalogs/sectors risponde", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/admin/catalogs/sectors`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });
});
