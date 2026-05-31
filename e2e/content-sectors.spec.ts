import { expect, test, type Page, type Route } from "@playwright/test";

type NewsMode = "content" | "empty" | "error";
type GrowthMode = "content" | "empty" | "error";
type SectorsMode = "content" | "empty" | "error";

const publishedAt = "2026-05-30T09:00:00.000Z";
const newsHeading = /news from the world of work|news|notizie/i;

test.use({ serviceWorkers: "block" });

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function mockNews(page: Page, mode: NewsMode) {
  await page.route("**/api/news/sector/**", async (route) => {
    if (mode === "error") {
      await fulfillJson(route, { error: "news_unavailable" }, 503);
      return;
    }
    await fulfillJson(route, {
      news: mode === "empty" ? [] : [newsItem("sector-news", "Skill AI nel manifatturiero")],
      source: "static",
      status: mode === "empty" ? "empty" : "ok",
    });
  });

  await page.route("**/api/news/subscriptions**", async (route) => {
    await fulfillJson(route, { subscriptions: [] });
  });

  await page.route("**/api/news?**", async (route) => {
    if (mode === "error") {
      await fulfillJson(route, { error: "news_unavailable" }, 503);
      return;
    }
    await fulfillJson(route, {
      news: mode === "empty" ? [] : [newsItem("general-news", "Osservatorio lavoro digitale")],
      source: "static",
      status: mode === "empty" ? "empty" : "ok",
    });
  });
}

async function mockGrowth(page: Page, mode: GrowthMode) {
  await mockAmbientNews(page);

  await page.route("**/api/crescita/categorie", async (route) => {
    if (mode === "error") {
      await fulfillJson(route, { error: "growth_unavailable" }, 503);
      return;
    }
    await fulfillJson(route, mode === "empty" ? [] : [
      {
        id: "focus",
        label: "Focus profondo",
        icon: "*",
        description: "Esercizi pratici per lavorare con continuita.",
        count: 2,
      },
    ]);
  });

  await page.route("**/api/crescita?**", async (route) => {
    if (mode === "error") {
      await fulfillJson(route, { error: "growth_unavailable" }, 503);
      return;
    }
    await fulfillJson(route, {
      articles: mode === "empty" ? [] : [
        {
          id: 11,
          title: "Routine settimanale di crescita",
          slug: "routine-settimanale",
          category: "focus",
          description: "Un percorso breve per trasformare obiettivi in pratica.",
          tags: ["focus", "abitudini"],
          difficulty: "base",
          readTimeMinutes: 6,
        },
      ],
    });
  });

  await page.route("**/api/crescita/per-te", async (route) => {
    await fulfillJson(route, {
      articles: [],
      hasProfile: false,
      personalization: "generic",
      status: "empty",
    });
  });
}

async function mockSectors(page: Page, mode: SectorsMode) {
  await mockAmbientNews(page);

  await page.route("**/api/sectors", async (route) => {
    if (mode === "error") {
      await fulfillJson(route, { error: "sectors_unavailable" }, 503);
      return;
    }
    await fulfillJson(route, mode === "empty" ? [] : [
      sector(1, "Cybersecurity operativa", ["I", "C"], "booming", "low"),
      sector(2, "Design dei servizi", ["A", "S"], "growing", "medium"),
      sector(3, "Energia sostenibile", ["R", "I"], "growing", "low"),
      sector(4, "Data science", ["I", "C"], "booming", "medium"),
    ]);
  });

  await page.route("**/api/test-sessions/latest", async (route) => {
    await fulfillJson(route, null, 404);
  });

  await page.route("**/api/users/me/work-preference", async (route) => {
    await fulfillJson(route, {}, 401);
  });
}

async function mockAmbientNews(page: Page) {
  await page.route("**/api/news?**", async (route) => {
    await fulfillJson(route, {
      news: [newsItem("ambient-news", "Ticker NorthStar deterministico")],
      source: "static",
      status: "ok",
    });
  });
}

function newsItem(id: string, title: string) {
  return {
    id,
    title,
    preview: "Scenario verificato dal test E2E.",
    description: "Scenario verificato dal test E2E.",
    source: "NorthStar Test Desk",
    sourceUrl: "https://example.test/source",
    url: "https://example.test/article",
    detailUrl: `/news/${id}`,
    publishedAt,
    image: null,
    category: "general",
    sector: null,
    tags: ["lavoro"],
    relevance: 0.91,
    plan: "free",
  };
}

function sector(
  id: number,
  name: string,
  riasecTypes: string[],
  trend: string,
  automationRisk: string,
) {
  return {
    id,
    name,
    description: `${name}: descrizione deterministica per E2E.`,
    icon: "compass",
    color: "#c19e4a",
    riasecTypes,
    skills: [],
    avgSalaryMin: 32000 + id * 1000,
    avgSalaryMax: 52000 + id * 1000,
    growthRate: 8,
    automationRisk,
    scalability: "medium",
    trend,
    timeToAutonomy: "6 mesi",
    advantages: [],
    disadvantages: [],
    opportunities: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    workMode: ["ibrido"],
  };
}

test.describe("content and sector runtime states", () => {
  test("news renders mocked articles instead of relying on live providers", async ({ page }) => {
    await mockNews(page, "content");

    await page.goto("/news");

    await expect(page.getByRole("heading", { level: 1, name: newsHeading })).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 3, name: "Osservatorio lavoro digitale" }),
    ).toBeVisible();
    await expect(page.getByText("NorthStar Test Desk").first()).toBeVisible();
  });

  test("news shows a clear empty state when the feed has no articles", async ({ page }) => {
    await mockNews(page, "empty");

    await page.goto("/news");

    await expect(page.getByText(/no news found|nessun risultato|nessuna notizia/i)).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: newsHeading })).toBeVisible();
  });

  test("news shows a clear error state when the feed request fails", async ({ page }) => {
    await mockNews(page, "error");

    await page.goto("/news");

    await expect(page.getByText(/unable to load news|non riesco|errore|riprova/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /retry|riprova/i })).toBeVisible();
  });

  test("growth renders categories and recent articles from mocked APIs", async ({ page }) => {
    await mockGrowth(page, "content");

    await page.goto("/crescita");

    await expect(page.getByRole("heading", { name: /crescita/i }).first()).toBeVisible();
    await expect(page.getByText("Focus profondo")).toBeVisible();
    await expect(page.getByText("Routine settimanale di crescita")).toBeVisible();
  });

  test("growth remains informative when content APIs return empty collections", async ({ page }) => {
    await mockGrowth(page, "empty");

    await page.goto("/crescita");

    await expect(page.getByText(/costruisci il tuo profilo di crescita/i)).toBeVisible();
    await expect(page.getByText(/don't know where to start|non sai da dove iniziare/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /crescita/i }).first()).toBeVisible();
  });

  test("growth shows a clear error state when content APIs fail", async ({ page }) => {
    await mockGrowth(page, "error");

    await page.goto("/crescita");

    await expect(
      page.getByText("Non riesco a caricare i contenuti di crescita adesso.").first(),
    ).toBeVisible();
  });

  test("sectors renders the decision pyramid from mocked backend data", async ({ page }) => {
    await mockSectors(page, "content");

    await page.goto("/settori");

    await expect(page.getByTestId("sector-pyramid")).toBeVisible();
    await expect(page.getByText("Cybersecurity operativa").first()).toBeVisible();
    await expect(page.getByText(/piramide mercato/i)).toBeVisible();
  });

  test("sectors shows an empty backend state instead of a blank explorer", async ({ page }) => {
    await mockSectors(page, "empty");

    await page.goto("/settori");

    await expect(page.getByText("Nessun dato backend")).toBeVisible();
    await expect(page.getByText("I settori non sono ancora disponibili.")).toBeVisible();
  });

  test("sectors shows a retryable error state when the catalog request fails", async ({ page }) => {
    await mockSectors(page, "error");

    await page.goto("/settori");

    await expect(page.getByText("Errore nel caricamento dei settori")).toBeVisible();
    await expect(page.getByRole("button", { name: /riprova/i })).toBeVisible();
  });
});
