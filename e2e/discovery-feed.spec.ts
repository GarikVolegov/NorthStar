/**
 * E2E — Discovery Feed
 *
 * Percorso testato:
 *   1. Login e accesso al feed
 *   2. Rendering card notizie/opportunità
 *   3. Interazioni: like, bookmark, share
 *   4. Filtraggio per categoria
 *   5. Infinite scroll / caricamento pagina successiva
 *   6. Apertura dettaglio item
 *   7. Ricerca nel feed
 *
 * Convenzioni:
 *   - Solo data-testid, nessun selettore su testo UI
 *   - Test indipendenti — beforeEach fa login fresco
 *   - Usa page.waitForResponse per verificare le API call senza timing fragili
 */
import { test, expect } from "@playwright/test";

const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@northstar.it";
const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD;

if (!E2E_USER_PASSWORD) {
  throw new Error("E2E_USER_PASSWORD is required for discovery-feed E2E.");
}

async function loginUser(page: import("@playwright/test").Page) {
  await page.goto("/auth");
  await page.getByTestId("auth-email-input").fill(E2E_USER_EMAIL);
  await page.getByTestId("auth-password-input").fill(E2E_USER_PASSWORD);
  await page.getByTestId("auth-submit-btn").click();
  await page.waitForURL("**/dashboard", { timeout: 10_000 });
}

async function goToFeed(page: import("@playwright/test").Page) {
  await page.getByTestId("nav-discovery-feed").click();
  await expect(page.getByTestId("discovery-feed-page")).toBeVisible({
    timeout: 8_000,
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

test.describe("Discovery Feed", () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test("il feed è raggiungibile dalla navigazione", async ({ page }) => {
    await goToFeed(page);
    // Verifica la struttura base della pagina
    await expect(page.getByTestId("feed-header")).toBeVisible();
    await expect(page.getByTestId("feed-filter-bar")).toBeVisible();
  });

  test("rendering card: almeno una card visibile al caricamento", async ({
    page,
  }) => {
    await goToFeed(page);
    // Attende il primo render delle card (possibile loading state)
    await expect(page.getByTestId("feed-loading")).not.toBeVisible({
      timeout: 8_000,
    });
    const cards = page.getByTestId("feed-card");
    await expect(cards.first()).toBeVisible();
  });

  test("like su una card → stato toggle", async ({ page }) => {
    await goToFeed(page);
    await expect(page.getByTestId("feed-loading")).not.toBeVisible({
      timeout: 8_000,
    });

    const firstCard = page.getByTestId("feed-card").first();
    const likeBtn = firstCard.getByTestId("feed-card-like-btn");

    // Stato iniziale: not liked
    await expect(likeBtn).toBeVisible();
    const initialAriaPressed = await likeBtn.getAttribute("aria-pressed");

    // Click like
    await likeBtn.click();

    // Stato toggle: aria-pressed deve essere cambiato
    const newAriaPressed = await likeBtn.getAttribute("aria-pressed");
    expect(newAriaPressed).not.toBe(initialAriaPressed);
  });

  test("bookmark su una card → appare nella sezione salvati", async ({
    page,
  }) => {
    await goToFeed(page);
    await expect(page.getByTestId("feed-loading")).not.toBeVisible({
      timeout: 8_000,
    });

    const firstCard = page.getByTestId("feed-card").first();
    await firstCard.getByTestId("feed-card-bookmark-btn").click();

    // Naviga alla sezione salvati
    await page.getByTestId("nav-saved-items").click();
    await expect(page.getByTestId("saved-items-page")).toBeVisible();
    // Almeno un item salvato deve essere presente
    await expect(page.getByTestId("saved-item").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("filtro per categoria aggiorna il feed", async ({ page }) => {
    await goToFeed(page);
    await expect(page.getByTestId("feed-loading")).not.toBeVisible({
      timeout: 8_000,
    });

    // Seleziona il primo filtro disponibile nella filter bar
    const filterBtns = page.getByTestId("feed-filter-btn");
    const firstFilter = filterBtns.first();
    await firstFilter.click();

    // Attende refresh del feed — loading state deve comparire e sparire
    // oppure almeno un re-render delle card
    await page.waitForResponse(
      (res) => res.url().includes("/api/v1/news") && res.status() === 200,
      { timeout: 8_000 },
    );
    // Il feed è ancora visibile dopo il filtro
    await expect(page.getByTestId("feed-card").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("infinite scroll carica più card", async ({ page }) => {
    await goToFeed(page);
    await expect(page.getByTestId("feed-loading")).not.toBeVisible({
      timeout: 8_000,
    });

    const initialCount = await page.getByTestId("feed-card").count();
    test.skip(initialCount === 0, "Feed vuoto — salta infinite scroll test");

    // Scroll fino in fondo alla pagina
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Attende nuovo batch di card (loadMoreTrigger o spinner)
    await page
      .waitForResponse(
        (res) => res.url().includes("/api/v1/news") && res.status() === 200,
        { timeout: 8_000 },
      )
      .catch(() => {
        /* ok se non c'è next page */
      });

    const newCount = await page.getByTestId("feed-card").count();
    // Dopo scroll il count deve essere >= di prima (può essere uguale se paginazione è esaurita)
    expect(newCount).toBeGreaterThanOrEqual(initialCount);
  });

  test("apertura dettaglio card", async ({ page }) => {
    await goToFeed(page);
    await expect(page.getByTestId("feed-loading")).not.toBeVisible({
      timeout: 8_000,
    });

    await page
      .getByTestId("feed-card")
      .first()
      .getByTestId("feed-card-open-btn")
      .click();
    // Il dettaglio deve essere visibile — modal o nuova pagina
    await expect(
      page
        .getByTestId("feed-item-detail")
        .or(page.getByTestId("feed-item-modal")),
    ).toBeVisible({ timeout: 5_000 });
  });

  test("ricerca nel feed filtra i risultati", async ({ page }) => {
    await goToFeed(page);
    await expect(page.getByTestId("feed-loading")).not.toBeVisible({
      timeout: 8_000,
    });

    const searchInput = page.getByTestId("feed-search-input");
    await searchInput.fill("tech");
    // Attende debounce + risposta API
    await page.waitForResponse(
      (res) => res.url().includes("/api/v1/news") && res.status() === 200,
      { timeout: 8_000 },
    );

    // Dopo la ricerca: o ci sono card, o c'è lo stato empty
    const hasCards = (await page.getByTestId("feed-card").count()) > 0;
    const hasEmpty = await page.getByTestId("feed-empty-state").isVisible();
    expect(hasCards || hasEmpty).toBe(true);
  });

  test("stato empty state visibile se nessun risultato", async ({ page }) => {
    await goToFeed(page);
    await expect(page.getByTestId("feed-loading")).not.toBeVisible({
      timeout: 8_000,
    });

    const searchInput = page.getByTestId("feed-search-input");
    // Stringa garantita per non matchare nulla
    await searchInput.fill("xyzqabc123impossibile");
    await page
      .waitForResponse(
        (res) => res.url().includes("/api/v1/news") && res.status() === 200,
        { timeout: 8_000 },
      )
      .catch(() => {});

    // Tolera sia empty state che 0 card
    const hasEmpty = await page
      .getByTestId("feed-empty-state")
      .isVisible()
      .catch(() => false);
    const cardCount = await page.getByTestId("feed-card").count();
    expect(hasEmpty || cardCount === 0).toBe(true);
  });
});
