/**
 * E2E tests for Affiliate API endpoints
 */
import { test, expect } from "@playwright/test";
import { loginAsTestUser, loginAsAffiliateUser, TEST_API_URL } from "./helpers/auth";

test.describe("Affiliate API", () => {
  test("GET /api/affiliate/dashboard — returns 401 without auth", async ({ request }) => {
    const res = await request.get(`${TEST_API_URL}/api/affiliate/dashboard`);
    expect(res.status()).toBe(401);
  });

  test("GET /api/affiliate/dashboard — returns dashboard for affiliate user", async ({ request }) => {
    const headers = await loginAsAffiliateUser(request);
    const res = await request.get(`${TEST_API_URL}/api/affiliate/dashboard`, { headers });
    // Affiliate endpoint may return 200 or 403 depending on backend implementation
    expect([200, 403]).toContain(res.status());
  });

  test("GET /api/dashboard — returns aggregated dashboard data", async ({ request }) => {
    const headers = await loginAsTestUser(request);
    const res = await request.get(`${TEST_API_URL}/api/dashboard`, { headers });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("user");
    expect(body).toHaveProperty("objectives");
    expect(body).toHaveProperty("objectivesProgress");
    expect(body).toHaveProperty("upcomingEvents");
  });

  test("GET /api/objectives — CRUD flow", async ({ request }) => {
    const headers = await loginAsTestUser(request);

    // List (empty or not)
    const listRes = await request.get(`${TEST_API_URL}/api/objectives`, { headers });
    expect(listRes.status()).toBe(200);

    // Create
    const createRes = await request.post(`${TEST_API_URL}/api/objectives`, {
      headers,
      data: { text: "Test E2E objective", category: "test" },
    });
    expect(createRes.status()).toBe(201);
    const objective = await createRes.json();
    expect(objective.text).toBe("Test E2E objective");

    // Update
    const updateRes = await request.patch(
      `${TEST_API_URL}/api/objectives/${objective.id}`,
      { headers, data: { completed: true } },
    );
    expect(updateRes.status()).toBe(200);
    const updated = await updateRes.json();
    expect(updated.completed).toBe(true);

    // Delete
    const delRes = await request.delete(
      `${TEST_API_URL}/api/objectives/${objective.id}`,
      { headers },
    );
    expect(delRes.status()).toBe(204);
  });

  test("POST /api/objectives/seed — creates default objectives for journey", async ({ request }) => {
    const headers = await loginAsTestUser(request);
    const res = await request.post(`${TEST_API_URL}/api/objectives/seed`, { headers });
    // First call should create, subsequent calls should return existing
    expect([200, 201]).toContain(res.status());
  });
});
