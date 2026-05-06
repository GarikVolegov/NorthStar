/**
 * API-only tests — no browser required. These run via `request` fixture.
 * Run with: pnpm test:e2e:api
 */
import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL ?? "http://localhost:8080";
const ADMIN_KEY = process.env.ADMIN_KEY ?? "northstar-admin";

test.describe("API Salute Sistema", () => {
  test("GET /api/healthz risponde 200", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/healthz`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("GET /api/health ritorna struttura corretta", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("services");
    expect(body).toHaveProperty("env");
  });

  test("GET /api/sectors ritorna array di settori", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/sectors`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    if (body.length > 0) {
      expect(body[0]).toHaveProperty("id");
      expect(body[0]).toHaveProperty("name");
    }
  });
});

test.describe("API Admin — auth", () => {
  test("GET /api/admin/metrics senza chiave → 401 o 403", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/admin/metrics`);
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/admin/metrics con chiave valida → 200", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/admin/metrics`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("users");
    expect(body).toHaveProperty("tests");
  });

  test("GET /api/admin/agent-health con chiave valida → 200", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/admin/agent-health`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("agents");
    expect(body).toHaveProperty("daily");
  });

  test("GET /api/admin/growth-queue con chiave valida → 200", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/admin/growth-queue`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("queue");
    expect(body).toHaveProperty("stats");
  });

  test("GET /api/admin/catalogs/sectors con chiave valida → array", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/admin/catalogs/sectors`, {
      headers: { "x-admin-key": ADMIN_KEY },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });
});

test.describe("API Utente — protezioni auth", () => {
  test("GET /api/objectives senza token → 401", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/objectives`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/profile/1 senza token → 401 o 404", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/profile/1`);
    expect([401, 403, 404]).toContain(res.status());
  });

  test("GET /api/test-sessions/latest senza token → 401", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/test-sessions/latest`);
    expect(res.status()).toBe(401);
  });
});
