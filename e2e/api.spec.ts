/**
 * API-only smoke tests. These run via Playwright's request fixture.
 */
import { test, expect } from "@playwright/test";

const API_BASE = process.env.API_URL ?? "http://localhost:8080";

test.describe("API health", () => {
  test("GET /api/health/live responds 200", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health/live`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("alive");
  });

  test("GET /api/health returns the base status", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("GET /api/health/ready returns readiness or an explicit DB error", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/health/ready`);
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    expect(["ready", "not ready"]).toContain(body.status);
  });

  test("GET /api/sectors returns an array", async ({ request }) => {
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

test.describe("API auth protections", () => {
  test("GET /api/admin/metrics without auth returns 401 or 403", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/admin/metrics`);
    expect([401, 403]).toContain(res.status());
  });

  test("GET /api/objectives without token returns 401", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/objectives`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/test-sessions/latest without token returns 401", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/test-sessions/latest`);
    expect(res.status()).toBe(401);
  });
});
