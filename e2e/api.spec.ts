/**
 * API-only smoke tests. These run via Playwright's request fixture.
 */
import { test, expect } from "@playwright/test";
import { readStringField, responseJson } from "./helpers/json";

const API_BASE = process.env.API_URL ?? "http://localhost:8080";

test.describe("API health", () => {
  test("GET /api/health/live responds 200", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health/live`);
    expect(res.status()).toBe(200);
    const body = await responseJson<unknown>(res);
    expect(readStringField(body, "status")).toBe("alive");
  });

  test("GET /api/health returns the base status", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/health`);
    expect(res.status()).toBe(200);
    const body = await responseJson<unknown>(res);
    expect(readStringField(body, "status")).toBe("ok");
  });

  test("GET /api/health/ready returns readiness or an explicit DB error", async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/health/ready`);
    expect([200, 503]).toContain(res.status());
    const body = await responseJson<unknown>(res);
    expect(["ready", "not ready"]).toContain(readStringField(body, "status"));
  });

  test("GET /api/sectors returns an array", async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/sectors`);
    expect(res.status()).toBe(200);
    const body = await responseJson<unknown>(res);
    expect(Array.isArray(body)).toBe(true);
    const sectors: unknown[] = Array.isArray(body) ? body : [];
    if (sectors.length > 0) {
      const first = sectors[0];
      expect(typeof first === "object" && first !== null && "id" in first).toBe(true);
      expect(typeof first === "object" && first !== null && "name" in first).toBe(true);
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
