import { expect, test } from "@playwright/test";
import { responseJson, readStringField } from "./helpers/json";

const API_BASE = process.env.API_URL ?? "http://localhost:8080";
const WEB_BASE = process.env.BASE_URL ?? "http://localhost:5000";

const MISMATCHED_CLERK_JWT = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJvdGhlciJ9.sig";

test.describe("core usage smoke", () => {
  test("readiness endpoint proves dependencies before browser smoke", async ({
    request,
  }) => {
    await expect
      .poll(
        async () => {
          const res = await request.get(`${API_BASE}/api/health/ready`);
          const body = await responseJson<unknown>(res);
          return {
            statusCode: res.status(),
            status: readStringField(body, "status"),
          };
        },
        {
          intervals: [500, 1000, 2000],
          timeout: 15_000,
        },
      )
      .toEqual({ statusCode: 200, status: "ok" });
  });

  test("landing page renders without runtime crash", async ({ page }) => {
    await page.goto(WEB_BASE);
    await expect(page).toHaveTitle(/NorthStar/i);
    await expect(page.locator("body")).toBeVisible();
  });

  test("protected dashboard redirects unauthenticated users to sign-in", async ({
    page,
  }) => {
    await page.goto(`${WEB_BASE}/dashboard`);
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("admin metrics route is mounted and protected", async ({ page }) => {
    await page.goto(`${WEB_BASE}/admin-metriche`);
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("Clerk sync never returns 500 for tokenless first sync payloads", async ({
    request,
  }) => {
    const timestamp = Date.now();
    const res = await request.post(`${API_BASE}/api/auth/clerk-sync`, {
      data: {
        clerkId: `smoke-clerk-${timestamp}`,
        email: `smoke_${timestamp}@northstar.test`,
        name: "Smoke User",
      },
    });
    expect(res.status(), await res.text()).not.toBe(500);
  });

  test("Clerk sync rejects mismatched bearer token without 500", async ({
    request,
  }) => {
    const timestamp = Date.now();
    const res = await request.post(`${API_BASE}/api/auth/clerk-sync`, {
      headers: {
        Authorization: `Bearer ${MISMATCHED_CLERK_JWT}`,
      },
      data: {
        clerkId: `smoke-clerk-${timestamp}`,
        email: `smoke_mismatch_${timestamp}@northstar.test`,
        name: "Smoke User",
      },
    });
    expect(res.status()).toBe(403);
  });
});
