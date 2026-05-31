import { test, expect } from "@playwright/test";
import { registerE2eUser } from "./helpers/auth";
import { responseJson } from "./helpers/json";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";
const API_BASE = process.env.API_URL ?? "http://localhost:8080";

type Objective = {
  id: number;
  text: string;
  category: string;
  progress: number;
  completed: boolean;
};

type DashboardResponse = {
  objectives: Objective[];
  objectivesProgress: {
    done: number;
    total: number;
    percent: number;
  };
};

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
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 });
    await expect(page.getByText(/accedi|sign in|login|registr/i).first()).toBeVisible();
  });

  test("dashboard reindirizza se non autenticato", async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page).toHaveURL(/\/sign-in/, { timeout: 10_000 });
    await expect(page.getByText(/accedi|sign in|login|registr/i).first()).toBeVisible();

    const authState = await page.evaluate(() => ({
      localToken: localStorage.getItem("northstar_token"),
      sessionToken: sessionStorage.getItem("northstar_token"),
    }));
    expect(authState).toEqual({ localToken: null, sessionToken: null });
  });
});

test.describe("API Obiettivi autenticata", () => {
  test("crea un obiettivo, aggiorna il progresso e lo riflette in dashboard", async ({
    request,
  }) => {
    const headers = await registerE2eUser(request, "objective-e2e");
    const text = `Obiettivo E2E avanzamento ${Date.now()}`;
    let objectiveId: number | null = null;

    try {
      const createResponse = await request.post(`${API_BASE}/api/objectives`, {
        headers,
        data: { text, category: "e2e_progress" },
      });
      expect(createResponse.status(), await createResponse.text()).toBe(201);
      const created = await responseJson<Objective>(createResponse);
      objectiveId = created.id;
      expect(created).toMatchObject({
        text,
        category: "e2e_progress",
        progress: 0,
        completed: false,
      });

      const progressResponse = await request.patch(
        `${API_BASE}/api/objectives/${objectiveId}`,
        { headers, data: { progress: 40 } },
      );
      expect(progressResponse.status(), await progressResponse.text()).toBe(200);
      const inProgress = await responseJson<Objective>(progressResponse);
      expect(inProgress.progress).toBe(40);
      expect(inProgress.completed).toBe(false);

      const dashboardResponse = await request.get(`${API_BASE}/api/dashboard`, {
        headers,
      });
      expect(dashboardResponse.status(), await dashboardResponse.text()).toBe(200);
      const dashboard = await responseJson<DashboardResponse>(dashboardResponse);
      const dashboardObjective = dashboard.objectives.find(
        (objective) => objective.id === objectiveId,
      );
      expect(dashboardObjective).toMatchObject({
        id: objectiveId,
        text,
        progress: 40,
        completed: false,
      });
      expect(dashboard.objectivesProgress.percent).toBe(
        dashboard.objectivesProgress.total > 0
          ? Math.round(
              (dashboard.objectivesProgress.done /
                dashboard.objectivesProgress.total) *
                100,
            )
          : 0,
      );

      const completeResponse = await request.patch(
        `${API_BASE}/api/objectives/${objectiveId}`,
        { headers, data: { completed: true } },
      );
      expect(completeResponse.status(), await completeResponse.text()).toBe(200);
      const completed = await responseJson<Objective>(completeResponse);
      expect(completed.progress).toBe(100);
      expect(completed.completed).toBe(true);
    } finally {
      if (objectiveId !== null) {
        await request.delete(`${API_BASE}/api/objectives/${objectiveId}`, {
          headers,
        });
      }
    }
  });
});

test.describe("API Pubblica", () => {
  test("GET /api/sectors restituisce lista settori", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/sectors`);
    expect(response.status()).toBe(200);
    const body = await responseJson<unknown[]>(response);
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
      const body = await responseJson<unknown>(response);
      expect(Array.isArray(body) || typeof body === "object").toBeTruthy();
    }
  });
});
