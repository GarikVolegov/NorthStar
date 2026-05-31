import { test, expect } from "@playwright/test";
import { responseJson } from "./helpers/json";

const BASE = process.env.BASE_URL ?? "http://localhost:5000";
const API_BASE = process.env.API_URL ?? "http://localhost:8080";

const COMPLETE_TEST_ANSWERS: Record<string, number> = {
  q1: 5,
  q2: 2,
  q3: 3,
  q4: 4,
  q5: 2,
  q6: 3,
  q7: 5,
  q8: 2,
  q9: 3,
  q10: 4,
  q11: 2,
  q12: 3,
  shen_1: 4,
  shen_2: 4,
  shen_3: 5,
  hun_1: 3,
  hun_2: 3,
  hun_3: 4,
  po_1: 2,
  po_2: 2,
  po_3: 3,
  yi_1: 4,
  yi_2: 5,
  yi_3: 4,
  zhi_1: 3,
  zhi_2: 4,
  zhi_3: 4,
  ctx_1: 3,
  ctx_2: 4,
};

type PublicTestSession = {
  id: number;
  answers: Record<string, number>;
  riasecScores: Record<string, number>;
  primaryTypes: string[];
  profileSummary: string;
  spiritScores: Record<string, number>;
  recommendations: unknown[];
};

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
    const response = await request.get(`${API_BASE}/api/health/live`);
    expect(response.status()).toBe(200);
    const body = await responseJson<{ status: string }>(response);
    expect(body.status).toBe("alive");
  });

  test("API /api/health restituisce stato base", async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);
    const body = await responseJson<{ status: string }>(response);
    expect(["ok", "fail"]).toContain(body.status);
    expect(response.status()).toBe(body.status === "ok" ? 200 : 503);
  });

  test("API pubblica crea una sessione RIASEC e rende il risultato accessibile", async ({
    request,
  }) => {
    const createResponse = await request.post(`${API_BASE}/api/test-sessions`, {
      data: { answers: COMPLETE_TEST_ANSWERS },
    });

    expect(createResponse.status(), await createResponse.text()).toBe(201);
    const created = await responseJson<PublicTestSession>(createResponse);

    expect(created.id).toBeGreaterThan(0);
    expect(created.answers.q1).toBe(5);
    expect(created.riasecScores.R).toBeGreaterThan(0);
    expect(created.primaryTypes.length).toBeGreaterThan(0);
    expect(created.profileSummary).toContain("Profilo");
    expect(created.spiritScores.shen).toBeGreaterThan(0);
    expect(Array.isArray(created.recommendations)).toBe(true);

    const resultResponse = await request.get(
      `${API_BASE}/api/test-sessions/${created.id}`,
    );
    expect(resultResponse.status(), await resultResponse.text()).toBe(200);
    const result = await responseJson<PublicTestSession>(resultResponse);

    expect(result.id).toBe(created.id);
    expect(result.primaryTypes).toEqual(created.primaryTypes);
    expect(result.riasecScores).toEqual(created.riasecScores);
  });

  test("mostra uno stato errore UX se il salvataggio del test fallisce", async ({
    page,
  }) => {
    await page.addInitScript((answers) => {
      localStorage.setItem("northstar_audio_muted", "1");
      localStorage.setItem(
        "northstar_test_draft",
        JSON.stringify({ step: 29, answers, savedAt: Date.now() }),
      );
    }, COMPLETE_TEST_ANSWERS);
    await page.route("**/api/test-sessions", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ error: "Errore test controllato" }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto(`${BASE}/test`);
    await page.getByRole("button", { name: /riprendi/i }).click();

    const discoverResultsButton = page.getByRole("button", {
      name: /scopri i tuoi risultati|discover your results/i,
    });
    await expect(
      discoverResultsButton,
    ).toBeVisible({ timeout: 20_000 });
    await discoverResultsButton.click();

    await expect(
      page.getByText(/Errore nell'invio\. Riprova\.|Submission error\. Please retry\./i),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(/\/test$/);
  });
});
