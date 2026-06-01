/**
 * Tablet visual QA for high-risk touch surfaces.
 *
 * Covers the 768px boundary where NorthStar switches away from the compact
 * mobile layout but still needs touch-friendly controls and contained overflow.
 */

import { expect, devices, test, type Locator, type Page } from "@playwright/test";
import { loginViaApi, waitForAuthReady } from "../helpers/auth";
import { projectBrowserDevice } from "../helpers/responsiveDevices";

test.use(projectBrowserDevice(devices["iPad Mini"]));

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    return {
      scrollWidth,
      clientWidth: doc.clientWidth,
      overflowBy: scrollWidth - doc.clientWidth,
    };
  });

  expect(overflow.overflowBy, JSON.stringify(overflow)).toBeLessThanOrEqual(1);
}

async function expectTouchTarget(locator: Locator, label: string) {
  await expect(locator, label).toBeVisible({ timeout: 15_000 });
  const box = await locator.boundingBox();
  expect(box, `${label} deve avere un bounding box`).not.toBeNull();
  if (!box) return;

  expect(box.height, `${label} deve essere alto almeno 44px`).toBeGreaterThanOrEqual(44);
  expect(box.width, `${label} deve essere largo almeno 44px`).toBeGreaterThanOrEqual(44);
}

async function mockApplications(page: Page) {
  const baseDate = "2026-05-31T09:00:00.000Z";
  const applications = [
    {
      id: 101,
      userId: 1,
      company: "NorthStar Product Operations International",
      role: "Senior Product Operations Specialist for marketplace intelligence",
      url: "https://example.com/jobs/product-ops",
      status: "saved",
      notes: "Referral caldo, annuncio lungo e molte informazioni da non tagliare sul tablet.",
      salary: "45.000 - 55.000 EUR",
      location: "Milano / Remote",
      appliedAt: baseDate,
      updatedAt: baseDate,
      notesLog: [{ text: "Preparare follow-up con portfolio sintetico.", createdAt: baseDate }],
    },
    {
      id: 102,
      userId: 1,
      company: "Data Compass Studio",
      role: "Career data analyst",
      url: "https://example.com/jobs/data-analyst",
      status: "applied",
      notes: "Candidatura inviata dal job board aggregato.",
      salary: "40.000 EUR",
      location: "Torino",
      appliedAt: baseDate,
      updatedAt: baseDate,
      notesLog: [],
    },
    {
      id: 103,
      userId: 1,
      company: "Interview Labs",
      role: "Customer research specialist",
      url: "https://example.com/jobs/research",
      status: "interview",
      notes: "Secondo colloquio da fissare.",
      salary: null,
      location: "Roma",
      appliedAt: "2026-05-20T09:00:00.000Z",
      updatedAt: "2026-05-20T09:00:00.000Z",
      notesLog: [{ text: "Inviare disponibilita entro venerdi.", createdAt: baseDate }],
    },
    {
      id: 104,
      userId: 1,
      company: "Offer Flow",
      role: "Growth operations lead",
      url: "https://example.com/jobs/growth",
      status: "offer",
      notes: "Offerta in valutazione.",
      salary: "60.000 EUR",
      location: "Hybrid",
      appliedAt: baseDate,
      updatedAt: baseDate,
      notesLog: [],
    },
    {
      id: 105,
      userId: 1,
      company: "Archive Talent",
      role: "Rejected role with very long title to exercise kanban column width",
      url: "https://example.com/jobs/archive",
      status: "rejected",
      notes: "Tenere come riferimento per prossime candidature.",
      salary: null,
      location: "Remote",
      appliedAt: baseDate,
      updatedAt: baseDate,
      notesLog: [],
    },
  ];

  await page.route("**/api/applications/*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ applications, status: "ok", totalCount: applications.length }),
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(applications[0]) });
  });
}

async function mockWendySearch(page: Page) {
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
  await page.route("**/api/ai/wendy", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream" },
      body: [
        'data: {"type":"status","value":"Controllo il layout tablet..."}',
        "",
        'data: {"type":"token","value":"Wendy resta leggibile anche al breakpoint tablet."}',
        "",
        'data: {"type":"done","requestId":"tablet-visual-qa","contextSources":["e2e-tablet"],"answerMode":"local-fast-path"}',
        "",
      ].join("\n"),
    });
  });
}

test.describe("Tablet Critical Visual QA", () => {
  test("candidature tablet mantiene kanban, dialog e controlli touch nel viewport", async ({ page }) => {
    await loginViaApi(page);
    await mockApplications(page);

    await page.goto("/candidature", { waitUntil: "domcontentloaded" });
    await waitForAuthReady(page);

    await expect(page.getByRole("heading", { name: /candidature|applications/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/NorthStar Product Operations International/i)).toBeVisible();
    await expectTouchTarget(page.getByRole("button", { name: /^aggiungi$|^add$/i }).first(), "bottone aggiungi candidatura");
    await expectTouchTarget(page.getByRole("button", { name: /cambia stato candidatura/i }).first(), "dropdown stato candidatura");
    await expectTouchTarget(page.getByRole("button", { name: /apri diario note/i }).first(), "bottone diario note");
    await expectTouchTarget(page.getByRole("link", { name: /apri offerta/i }).first(), "link offerta candidatura");
    await expectNoHorizontalOverflow(page);

    const kanban = page.locator(".overflow-x-auto").first();
    await kanban.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    await expect(page.getByText(/Archive Talent/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /^aggiungi$|^add$/i }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expectTouchTarget(dialog.getByPlaceholder(/Google Italia|Google/i), "input azienda dialog candidatura");
    await expectTouchTarget(dialog.getByPlaceholder(/UX Designer/i), "input ruolo dialog candidatura");
    await expectTouchTarget(dialog.locator("select"), "select stato dialog candidatura");
    await expectTouchTarget(dialog.getByRole("button", { name: /^aggiungi$|^add$/i }), "submit dialog candidatura");
    await expectNoHorizontalOverflow(page);
  });

  test("Search/Wendy al breakpoint tablet resta raggiungibile e senza overflow", async ({ page }) => {
    await mockWendySearch(page);

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: /apri ricerca wendy/i }).click();

    const input = page.getByRole("combobox").or(page.getByRole("textbox")).first();
    await expectTouchTarget(input, "input ricerca Wendy tablet");
    await input.fill("carriera tablet");

    const askButton = page.getByRole("button", { name: /Chiedi a Wendy di guidarti su "carriera tablet"/i });
    await expectTouchTarget(askButton, "azione chiedi a Wendy tablet");
    await expectNoHorizontalOverflow(page);

    await askButton.click();
    await expect(page.getByRole("region", { name: "Chat Wendy" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Wendy resta leggibile anche al breakpoint tablet/i)).toBeVisible({ timeout: 10_000 });
    await expectTouchTarget(page.getByRole("button", { name: /Invia a Wendy|Interrompi Wendy/i }).last(), "controllo invio Wendy tablet");
    await expectNoHorizontalOverflow(page);
  });
});
