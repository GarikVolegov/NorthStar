import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewsCard, NewsDiagnosticsPanel } from "./NewsCards";
import type { NewsItem } from "./newsModels";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());
const i18nLanguageMock = vi.hoisted(() => ({ value: "en-US" }));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/hooks/useFavorites", () => ({
  useFavorites: () => ({
    addFavorite: vi.fn(),
    getNewsFavoriteId: () => undefined,
    isLoading: false,
    isNewsFavorite: () => false,
    removeFavorite: vi.fn(),
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: i18nLanguageMock.value,
      resolvedLanguage: i18nLanguageMock.value,
    },
    t: (key: string, options?: Record<string, unknown>) =>
      ({
        "news.categories.general": "General",
        "news.openSource": "Source",
        "news.timeAgo.lessThan1h": "Just now",
      })[key] ?? String(options?.defaultValue ?? key),
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
  useLocation: () => ["/news", vi.fn()],
}));

const item: NewsItem = {
  category: "general",
  description: "Useful context",
  id: "1",
  image: null,
  plan: "free",
  publishedAt: new Date().toISOString(),
  relevance: 70,
  sector: null,
  source: "GNews",
  sourceUrl: "https://example.com/source",
  tags: [],
  title: "Market signal",
  url: "https://example.com/source",
};

describe("NewsCard", () => {
  beforeEach(() => {
    i18nLanguageMock.value = "en-US";
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ source }: { source: string }) => source);
  });

  it("localizes the source link label", () => {
    render(<NewsCard item={item} />);

    const links = screen.getAllByRole("link", { name: /source/i });
    expect(links.some((link) => link.getAttribute("href") === item.sourceUrl)).toBe(true);
    expect(screen.queryByText("Fonte")).not.toBeInTheDocument();
  });

  it("keeps an accessible fallback visual when the article image is missing or broken", () => {
    const { rerender } = render(<NewsCard item={{ ...item, image: null }} />);

    expect(screen.getByRole("img", { name: /market signal/i })).toBeInTheDocument();

    rerender(<NewsCard item={{ ...item, image: "https://example.com/broken.jpg" }} />);
    const image = screen.getByRole("img", { name: "Market signal" });

    fireEvent.error(image);

    expect(screen.getByRole("img", { name: /market signal/i })).toBeInTheDocument();
  });
});

describe("NewsDiagnosticsPanel", () => {
  beforeEach(() => {
    i18nLanguageMock.value = "en-US";
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => key ? `dynamic:${key}` : source,
    );
  });

  it("uses dynamic translations and formats dates with the selected locale", () => {
    const lastAttemptAt = "2026-06-01T10:00:00.000Z";
    render(
      <NewsDiagnosticsPanel
        diagnostics={{
          providerStatus: "degraded",
          lastAttemptAt,
          enabledSources: 2,
          sourcesWithErrors: 1,
          refreshAction: "check_provider_keys",
          message: "GNews e Tavily hanno restituito errori.",
          lastRefreshError: "quota exceeded",
        }}
      />,
    );

    const expectedDate = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(lastAttemptAt));

    expect(screen.getByText("dynamic:news.diagnostics.status.degraded")).toBeInTheDocument();
    expect(screen.getByText("dynamic:news.diagnostics.check_provider_keys")).toBeInTheDocument();
    expect(screen.getByText("dynamic:news.diagnostics.message")).toBeInTheDocument();
    expect(screen.getByText("dynamic:news.diagnostics.enabledSources")).toBeInTheDocument();
    expect(screen.getByText("dynamic:news.diagnostics.sourcesWithErrors")).toBeInTheDocument();
    expect(screen.getByText("dynamic:news.diagnostics.lastAttempt")).toBeInTheDocument();
    expect(screen.getByText(expectedDate)).toBeInTheDocument();
    expect(screen.queryByText(/01\/06\/2026/)).not.toBeInTheDocument();
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({ source: "quota exceeded" }));
  });
});
