import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import News from "./news";

const getJsonMock = vi.hoisted(() => vi.fn());

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
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
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

describe("News page reliability states", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
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
        },
      },
    });
    getJsonMock.mockRejectedValue(error);

    renderNews();

    expect(await screen.findByText("news.loadError")).toBeInTheDocument();
    expect(screen.getByText(/GNews e Tavily hanno restituito errori/i)).toBeInTheDocument();
    expect(screen.getByText(/Controlla chiavi e limiti provider/i)).toBeInTheDocument();
  });
});
