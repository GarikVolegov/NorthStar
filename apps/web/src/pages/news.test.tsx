import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import News from "./news";

const getJsonMock = vi.hoisted(() => vi.fn());
const i18nLanguageMock = vi.hoisted(() => ({ value: "it" }));

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
  postJson: vi.fn(),
  deleteJson: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null, isLoggedIn: false, authReady: true }),
}));

vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => ({
    isNewsFavorite: () => false,
    getNewsFavoriteId: () => undefined,
    addFavorite: vi.fn(),
    removeFavorite: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: vi.fn(),
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => ({
      "news.meaning.audience": "Per chi è",
      "news.meaning.happened": "Cosa è successo",
      "news.meaning.why": "Perché conta per l'utente",
      "news.meaning.practical": "Cosa fare adesso",
    }[key] ?? options?.defaultValue ?? key),
    i18n: {
      language: i18nLanguageMock.value,
      resolvedLanguage: i18nLanguageMock.value,
    },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => ["/news", vi.fn()],
}));

vi.mock("@/components/skeletons/NewsCardSkeleton", () => ({
  NewsGridSkeleton: ({ count }: { count: number }) => <div data-testid="news-skeleton">{count}</div>,
}));

function renderNews() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <News />
    </QueryClientProvider>,
  );
}

function newsItem(id: string, title: string) {
  return {
    id,
    title,
    description: `${title} description`,
    source: "NorthStar News",
    url: `https://example.com/news/${id}`,
    publishedAt: "2026-05-31T08:00:00.000Z",
    image: null,
    category: "general",
    sector: null,
    tags: [],
    relevance: 80,
    plan: "free" as const,
  };
}

function meaningfulNewsItem(id: string, title: string) {
  return {
    ...newsItem(id, title),
    meaning: {
      audience: "Per chi segue Tecnologia & Software.",
      happened: "Le imprese cercano nuove competenze digitali.",
      whyItMatters: "Questa notizia aiuta l'utente a capire quali scelte professionali anticipare.",
      practicalNextStep: "Confronta il segnale con il tuo percorso e scegli una competenza da verificare questa settimana.",
      action: "Confronta il segnale con il tuo percorso e scegli una competenza da verificare questa settimana.",
      signal: "Segnale per il tuo percorso",
      sections: [
        { key: "audience", body: "Per chi segue Tecnologia & Software." },
        { key: "happened", body: "Le imprese cercano nuove competenze digitali." },
        { key: "why", body: "Questa notizia aiuta l'utente a capire quali scelte professionali anticipare." },
        { key: "practical", body: "Confronta il segnale con il tuo percorso e scegli una competenza da verificare questa settimana." },
      ],
    },
  };
}

describe("News page reliability states", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    i18nLanguageMock.value = "it";
  });

  it("shows an API error state instead of the empty-news state when the feed fails", async () => {
    getJsonMock.mockRejectedValue(new Error("news_unavailable"));

    renderNews();

    expect(await screen.findByText("news.loadError")).toBeInTheDocument();
    expect(screen.queryByText("news.noResults")).not.toBeInTheDocument();
  });

  it("shows the real empty state when the API succeeds with no news", async () => {
    getJsonMock.mockResolvedValue({ news: [], source: "live", status: "empty" });

    renderNews();

    expect(await screen.findByText("news.noResults")).toBeInTheDocument();
    expect(screen.queryByText("news.loadError")).not.toBeInTheDocument();
  });

  it("shows provider diagnostics when an empty feed explains why news are missing", async () => {
    getJsonMock.mockResolvedValue({
      news: [],
      source: "live",
      status: "empty",
      diagnostics: {
        providerStatus: "never_run",
        lastAttemptAt: null,
        enabledSources: 2,
        sourcesWithErrors: 0,
        refreshAction: "wait_for_startup_pipeline",
        message: "Le fonti news sono configurate, ma la pipeline non ha ancora registrato un fetch.",
      },
    });

    renderNews();

    expect(await screen.findByText("news.noResults")).toBeInTheDocument();
    expect(screen.getByText(/pipeline non ha ancora registrato un fetch/i)).toBeInTheDocument();
    expect(screen.getByText(/Pipeline in avvio/i)).toBeInTheDocument();
    expect(screen.getByText("Mai eseguito")).toBeInTheDocument();
    expect(screen.getByText("Fonti attive")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Non registrato")).toBeInTheDocument();
  });

  it("keeps provider diagnostics visible when the feed request fails", async () => {
    const error = Object.assign(new Error("news_unavailable"), {
      body: {
        diagnostics: {
          providerStatus: "degraded",
          lastAttemptAt: "2026-05-31T08:01:00.000Z",
          enabledSources: 2,
          sourcesWithErrors: 2,
          refreshAction: "check_provider_keys",
          message: "GNews e Tavily hanno restituito errori: controlla chiavi provider o quota.",
          lastRefreshError: "quota exceeded",
        },
      },
    });
    getJsonMock.mockRejectedValue(error);

    renderNews();

    expect(await screen.findByText("news.loadError")).toBeInTheDocument();
    expect(screen.getByText(/GNews e Tavily hanno restituito errori/i)).toBeInTheDocument();
    expect(screen.getByText(/Controlla chiavi e limiti provider/i)).toBeInTheDocument();
    expect(screen.getByText("Fonti degradate")).toBeInTheDocument();
    expect(screen.getByText(/Ultimo errore refresh: quota exceeded/i)).toBeInTheDocument();
  });

  it("loads the next cursor page and appends articles to the current feed", async () => {
    const user = userEvent.setup();
    const firstPageItem = newsItem("1", "Prima news");
    const secondPageItem = newsItem("2", "Seconda news");

    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("cursor=cursor-1")) {
        return Promise.resolve({
          news: [secondPageItem],
          nextCursor: null,
          source: "live",
          status: "ok",
        });
      }

      return Promise.resolve({
        news: [firstPageItem],
        nextCursor: "cursor-1",
        source: "live",
        status: "ok",
      });
    });

    renderNews();

    expect(await screen.findByText("Prima news")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Carica altre notizie|news\.loadMore/i }));

    expect(await screen.findByText("Seconda news")).toBeInTheDocument();
    expect(screen.getByText("Prima news")).toBeInTheDocument();
    expect(getJsonMock.mock.calls.some(([url]) => String(url).includes("cursor=cursor-1"))).toBe(true);
  });

  it("requests news using the selected interface language", async () => {
    i18nLanguageMock.value = "en";
    getJsonMock.mockResolvedValue({
      news: [newsItem("1", "English feed request")],
      nextCursor: null,
      source: "live",
      status: "ok",
    });

    renderNews();

    expect(await screen.findByText("English feed request")).toBeInTheDocument();
    expect(getJsonMock.mock.calls.some(([url]) => String(url).includes("locale=en"))).toBe(true);
  });

  it("shows a language-specific unavailable state when translated news cannot be served", async () => {
    i18nLanguageMock.value = "en";
    getJsonMock.mockRejectedValue(Object.assign(new Error("news_translation_unavailable"), {
      body: {
        error: "news_translation_unavailable",
        requestedLocale: "en",
      },
    }));

    renderNews();

    expect(await screen.findByText("news.translationUnavailable.title")).toBeInTheDocument();
    expect(screen.getByText("news.translationUnavailable.desc")).toBeInTheDocument();
    expect(screen.queryByText("news.loadError")).not.toBeInTheDocument();
  });

  it("shows the four user-facing meaning sections for each news card", async () => {
    getJsonMock.mockResolvedValue({
      news: [meaningfulNewsItem("1", "News con significato chiaro")],
      nextCursor: null,
      source: "live",
      status: "ok",
    });

    renderNews();

    expect(await screen.findByText("News con significato chiaro")).toBeInTheDocument();
    expect(screen.getByText("Per chi è")).toBeInTheDocument();
    expect(screen.getByText("Cosa è successo")).toBeInTheDocument();
    expect(screen.getByText("Perché conta per l'utente")).toBeInTheDocument();
    expect(screen.getByText("Cosa fare adesso")).toBeInTheDocument();
    expect(screen.getByText(/competenza da verificare questa settimana/i)).toBeInTheDocument();
  });

  it("keeps loaded articles visible when loading another page fails", async () => {
    const user = userEvent.setup();
    const firstPageItem = newsItem("1", "News gia caricata");

    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("cursor=cursor-1")) {
        return Promise.reject(new Error("load_more_failed"));
      }

      return Promise.resolve({
        news: [firstPageItem],
        nextCursor: "cursor-1",
        source: "live",
        status: "ok",
      });
    });

    renderNews();

    expect(await screen.findByText("News gia caricata")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: /Carica altre notizie|news\.loadMore/i }));

    expect(await screen.findByText("News gia caricata")).toBeInTheDocument();
    expect(await screen.findByText("news.loadMoreError")).toBeInTheDocument();
    expect(screen.queryByText("news.loadError")).not.toBeInTheDocument();
  });
});
