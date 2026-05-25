/**
 * E2E tests for Affiliate API endpoints.
 */
import { test, expect } from "@playwright/test";
import { loginAsTestUser, TEST_API_URL } from "./helpers/auth";
import { responseJson } from "./helpers/json";

type AffiliateDashboard = {
  referralCode: string;
  referralLink: string;
  qrCodeUrl: string;
};

type Objective = {
  id: number;
  text: string;
  completed: boolean;
};

test.describe("Affiliate API", () => {
  test("GET /api/affiliate/dashboard returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${TEST_API_URL}/api/affiliate/dashboard`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/affiliate/dashboard returns dashboard for a normal user", async ({ request }) => {
    const headers = await loginAsTestUser(request);
    const res = await request.get(`${TEST_API_URL}/api/affiliate/dashboard`, { headers });
    expect(res.status()).toBe(200);

    const body = await responseJson<AffiliateDashboard>(res);
    expect(body.referralCode).toBeTruthy();
    expect(body.referralLink).toMatch(/^https?:\/\/.+\/sign-up\?ref=/);
    expect(body.referralLink).toContain(encodeURIComponent(body.referralCode));
    expect(body.qrCodeUrl).toBe("/api/affiliate/qr");
  });

  test("GET /api/affiliate/qr returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${TEST_API_URL}/api/affiliate/qr`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/affiliate/qr returns an internal SVG QR for a normal user", async ({ request }) => {
    const headers = await loginAsTestUser(request);
    const dashboardRes = await request.get(`${TEST_API_URL}/api/affiliate/dashboard`, { headers });
    expect(dashboardRes.status()).toBe(200);
    const dashboard = await responseJson<AffiliateDashboard>(dashboardRes);

    const qrRes = await request.get(`${TEST_API_URL}/api/affiliate/qr`, { headers });
    expect(qrRes.status()).toBe(200);
    expect(qrRes.headers()["content-type"]).toContain("image/svg+xml");
    expect(qrRes.headers()["cache-control"]).toContain("private");

    const svg = await qrRes.text();
    expect(svg).toContain("<svg");
    expect(svg).not.toContain("chart.googleapis.com");
    expect(svg).toContain(dashboard.referralLink);
    expect(svg).toContain("path");
    expect(dashboard.qrCodeUrl).toBe("/api/affiliate/qr");
  });

  test("GET /api/dashboard returns aggregated dashboard data", async ({ request }) => {
    const headers = await loginAsTestUser(request);
    const res = await request.get(`${TEST_API_URL}/api/dashboard`, { headers });
    expect(res.status()).toBe(200);
    const body = await responseJson<Record<string, unknown>>(res);
    expect(body).toHaveProperty("user");
    expect(body).toHaveProperty("objectives");
    expect(body).toHaveProperty("objectivesProgress");
    expect(body).toHaveProperty("upcomingEvents");
  });

  test("GET /api/objectives CRUD flow", async ({ request }) => {
    const headers = await loginAsTestUser(request);

    const listRes = await request.get(`${TEST_API_URL}/api/objectives`, { headers });
    expect(listRes.status()).toBe(200);

    const createRes = await request.post(`${TEST_API_URL}/api/objectives`, {
      headers,
      data: { text: "Test E2E objective", category: "test" },
    });
    expect(createRes.status()).toBe(201);
    const objective = await responseJson<Objective>(createRes);
    expect(objective.text).toBe("Test E2E objective");

    const updateRes = await request.patch(
      `${TEST_API_URL}/api/objectives/${objective.id}`,
      { headers, data: { completed: true } },
    );
    expect(updateRes.status()).toBe(200);
    const updated = await responseJson<Objective>(updateRes);
    expect(updated.completed).toBe(true);

    const delRes = await request.delete(
      `${TEST_API_URL}/api/objectives/${objective.id}`,
      { headers },
    );
    expect(delRes.status()).toBe(204);
  });

  test("POST /api/objectives/seed creates default objectives for journey", async ({ request }) => {
    const headers = await loginAsTestUser(request);
    const res = await request.post(`${TEST_API_URL}/api/objectives/seed`, { headers });
    expect([200, 201]).toContain(res.status());
  });
});
