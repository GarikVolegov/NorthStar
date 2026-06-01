/**
 * Mobile visual QA per Wendy/Search/Dashboard.
 *
 * Lo scopo e intercettare overflow orizzontale e controlli non raggiungibili
 * sulle superfici critiche, usando un viewport reale Playwright.
 */

import { expect, devices, test, type Locator, type Page } from "@playwright/test";
import { loginViaApi, waitForAuthReady } from "../helpers/auth";
import { projectBrowserDevice } from "../helpers/responsiveDevices";

test.use(projectBrowserDevice(devices["Pixel 5"]));

function searchInput(page: Page) {
  return page.getByRole("combobox").or(page.getByRole("textbox")).first();
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const maxScrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const clientWidth = doc.clientWidth;
    return {
      scrollWidth: maxScrollWidth,
      clientWidth,
      overflowBy: maxScrollWidth - clientWidth,
    };
  });

  expect(overflow.overflowBy, JSON.stringify(overflow)).toBeLessThanOrEqual(1);
}

async function expectReachableInViewport(locator: Locator, label: string) {
  await expect(locator, label).toBeVisible({ timeout: 10_000 });
  const box = await locator.boundingBox();
  expect(box, `${label} deve avere un bounding box`).not.toBeNull();
  const viewport = locator.page().viewportSize();
  expect(viewport, "Il viewport Playwright deve essere definito").not.toBeNull();
  if (!box || !viewport) return;

  expect(box.x + box.width, `${label} non deve uscire a destra`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.x, `${label} non deve uscire a sinistra`).toBeGreaterThanOrEqual(-1);
  expect(box.y + Math.min(box.height, 44), `${label} deve avere almeno il tap target iniziale visibile`).toBeLessThanOrEqual(viewport.height + 1);
}

async function mockWendyStream(page: Page, answer = "Risposta mobile di Wendy pronta.") {
  await page.route("**/api/ai/wendy", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: [
        'data: {"type":"status","value":"Leggo il contesto mobile..."}',
        "",
        `data: {"type":"token","value":"${answer}"}`,
        "",
        'data: {"type":"done","requestId":"mobile-visual-qa","contextSources":["e2e-mobile"],"answerMode":"local-fast-path"}',
        "",
      ].join("\n"),
    });
  });
}

async function mockMemoryApi(page: Page) {
  let facts = [
    {
      id: 1,
      key: "user_manual",
      value: "Preferisco piani di carriera sintetici e azioni piccole.",
      source: "user_manual",
      confirmedCount: 1,
      createdAt: "2026-05-31T10:00:00.000Z",
    },
  ];

  await page.route("**/api/coach/memory**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ facts }) });
      return;
    }
    if (request.method() === "POST") {
      const data = request.postDataJSON() as { value?: string };
      const fact = {
        id: 2,
        key: "user_manual",
        value: data.value ?? "Nuovo fatto mobile",
        source: "user_manual",
        confirmedCount: 1,
        createdAt: "2026-05-31T10:01:00.000Z",
      };
      facts = [fact, ...facts];
      await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ fact }) });
      return;
    }
    await route.fulfill({ status: 204, body: "" });
  });
}

async function mockDashboardApis(page: Page) {
  const session = {
    id: 91,
    riasecScores: { R: 20, I: 36, A: 28, S: 44, E: 32, C: 18 },
    primaryTypes: ["S", "I"],
    spiritScores: { autonomy: 70, stability: 60 },
    recommendations: [
      { sectorId: 1, sectorName: "Prodotto digitale", matchScore: 87, matchReason: "Buon allineamento" },
      { sectorId: 2, sectorName: "Formazione", matchScore: 79, matchReason: "Forte componente sociale" },
    ],
    createdAt: "2026-05-31T09:00:00.000Z",
  };

  await page.route("**/api/dashboard/layout", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ layout: [] }) });
  });
  await page.route("**/api/dashboard", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          journeyType: "dipendente",
          name: "Mobile QA",
          email: "mobile-qa@northstar.test",
          isPremium: false,
          onboardingCompleted: true,
        },
        session,
        objectives: [
          {
            id: 7,
            text: "Preparare una conversazione di crescita",
            category: "career",
            progress: 40,
            completed: false,
            completedAt: null,
            isCertifiableMilestone: false,
            dueDate: null,
            createdAt: "2026-05-31T09:30:00.000Z",
          },
        ],
        objectivesProgress: { done: 0, total: 1, percent: 0 },
        upcomingEvents: [],
      }),
    });
  });
  await page.route("**/api/test-sessions/latest", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: session.id,
        recommendations: session.recommendations,
        riasecScores: session.riasecScores,
        primaryTypes: session.primaryTypes,
        spiritScores: session.spiritScores,
        createdAt: session.createdAt,
      }),
    });
  });
  await page.route("**/api/test-sessions/91", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
  });
  await page.route("**/api/agent", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        plan: "free",
        data: {
          durationMs: 12,
          validation: { valid: true, errors: [], warnings: [] },
          summary: {
            professions: [
              {
                title: "Product Operations Specialist",
                sector: "Prodotto digitale",
                skills: ["analisi", "comunicazione"],
                workModes: ["ibrido"],
                salaryRange: "35-45k",
                growthOutlook: "positivo",
              },
            ],
            workMode: {
              recommended: "hybrid",
              recommendedLabel: "Ibrido",
              riasecFit: "Buon equilibrio fra collaborazione e focus.",
            },
          },
        },
      }),
    });
  });
  await page.route("**/api/proactive-insights**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ insights: [], unreadCount: 0 }) });
  });
  await page.route("**/api/monthly-ritual/current", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        active: false,
        phase: "inactive",
        ritualMonth: "2026-05",
        ritualDate: "2026-05-31",
        nextRitualDate: "2026-06-30",
        preferences: { ritualEnabled: false, emailReminderEnabled: false },
        run: null,
      }),
    });
  });
  await page.route("**/api/routines/feed**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });
}

async function loginAndWarmAuth(page: Page) {
  await loginViaApi(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForAuthReady(page);
}

test.describe("Mobile Visual QA - Wendy e dashboard", () => {
  test("SearchDialog/Wendy mobile resta nel viewport e la chat e raggiungibile", async ({ page }) => {
    await mockWendyStream(page, "Wendy risponde dentro la ricerca mobile.");
    await page.route("**/api/search/hybrid", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [], has_semantic: false, searchMode: "keyword", indexStatus: "ready" }),
      });
    });
    await page.route("**/api/search/suggest**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ suggestions: [] }) });
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /apri ricerca wendy/i }).tap();

    const input = searchInput(page);
    await expectReachableInViewport(input, "input ricerca Wendy");
    await input.fill("carriera mobile");
    const askButton = page.getByRole("button", { name: /Chiedi a Wendy di guidarti su "carriera mobile"/i });
    await expectReachableInViewport(askButton, "azione chiedi a Wendy");
    await expectNoHorizontalOverflow(page);

    await askButton.tap();
    await expect(page.getByRole("region", { name: "Chat Wendy" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Wendy risponde dentro la ricerca mobile/i)).toBeVisible({ timeout: 10_000 });
    await expectReachableInViewport(page.getByRole("button", { name: /Invia a Wendy|Interrompi Wendy/i }).last(), "controllo invio Wendy");
    await expectNoHorizontalOverflow(page);
  });

  test("pagina Wendy fullscreen mobile espone composer e controlli senza overflow", async ({ page }) => {
    await mockWendyStream(page, "Risposta fullscreen mobile.");
    await loginAndWarmAuth(page);

    await page.goto("/wendy", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: "Wendy" })).toBeVisible({ timeout: 10_000 });
    await expectReachableInViewport(page.getByRole("link", { name: /torna alla dashboard/i }), "link ritorno dashboard");
    await expectReachableInViewport(page.getByPlaceholder("Chiedi a Wendy..."), "composer Wendy fullscreen");
    await expectNoHorizontalOverflow(page);

    await page.getByPlaceholder("Chiedi a Wendy...").fill("controlla il mio percorso");
    await page.getByRole("button", { name: "Invia a Wendy" }).tap();
    await expect(page.getByText(/Risposta fullscreen mobile/i)).toBeVisible({ timeout: 10_000 });
    await expectNoHorizontalOverflow(page);
  });

  test("memoria Wendy mobile consente lettura e aggiunta manuale senza overflow", async ({ page }) => {
    await mockMemoryApi(page);
    await loginAndWarmAuth(page);

    await page.goto("/wendy/memoria", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { name: /Memoria di Wendy/i })).toBeVisible();
    await expect(page.getByText(/Preferisco piani di carriera sintetici/i)).toBeVisible({ timeout: 10_000 });
    const memoryInput = page.getByPlaceholder(/Aggiunge un fatto manuale/i);
    await expectReachableInViewport(memoryInput, "input memoria Wendy");
    await expectReachableInViewport(page.getByRole("button", { name: /Aggiungi/i }), "bottone aggiungi memoria");
    await expectNoHorizontalOverflow(page);

    await memoryInput.fill("Sto valutando una crescita verso product operations");
    await page.getByRole("button", { name: /Aggiungi/i }).tap();
    await expect(page.getByText(/product operations/i)).toBeVisible({ timeout: 10_000 });
    await expectNoHorizontalOverflow(page);
  });

  test("dashboard mobile mostra contenuto critico e permette apertura Wendy senza overflow", async ({ page }) => {
    await mockDashboardApis(page);
    await mockWendyStream(page, "Wendy e raggiungibile dalla dashboard mobile.");
    await loginAndWarmAuth(page);

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/La tua bussola personale|Pannello di controllo/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Chiedi a Wendy|Settori consigliati per te|Strumenti del percorso/i).first()).toBeVisible({ timeout: 10_000 });
    await expectNoHorizontalOverflow(page);

    const openWendy = page.getByRole("button", { name: /apri ricerca wendy/i });
    await expectReachableInViewport(openWendy, "bottone Wendy dashboard");
    await openWendy.tap();
    await expect(page).toHaveURL(/\/wendy$/);
    const wendyComposer = page.getByPlaceholder("Chiedi a Wendy...");
    await expectReachableInViewport(wendyComposer, "input Wendy dalla dashboard");
    await wendyComposer.fill("prossimo passo");
    const sendWendy = page.getByRole("button", { name: "Invia a Wendy" }).last();
    await expectReachableInViewport(sendWendy, "bottone invia Wendy dalla dashboard");
    await sendWendy.tap();
    await expect(page.getByText(/Wendy e raggiungibile dalla dashboard mobile/i)).toBeVisible({ timeout: 10_000 });
    await expectNoHorizontalOverflow(page);
  });
});
