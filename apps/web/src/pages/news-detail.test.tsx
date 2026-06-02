import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewsDetail from "./news-detail";

const apiFetchMock = vi.hoisted(() => vi.fn());
const useDynamicTranslationMock = vi.hoisted(() => vi.fn());
const i18nLanguageMock = vi.hoisted(() => ({ value: "fr" }));

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => ({
      "news.categories.technology": "Technologie localisee",
      "news.meaning.audience": "Pour qui",
      "news.meaning.happened": "Ce qui s'est passé",
      "news.meaning.why": "Pourquoi cela compte pour vous",
      "news.meaning.practical": "Que faire maintenant",
      "news.detail.backToNews": "Retour aux actualités",
      "news.detail.sourceNote": "Note source",
      "news.detail.readSource": "Lire à la source",
      "news.title": "Actualités",
      "seo.news.description": "Description SEO",
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
  useRoute: () => [true, { id: "42" }],
}));

function renderNewsDetail() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <NewsDetail />
    </QueryClientProvider>,
  );
}

describe("News detail page", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ source }: { source: string }) => source);
    i18nLanguageMock.value = "fr";
  });

  it("requests and renders the article in the selected interface language", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        article: {
          id: "42",
          title: "Actualité claire",
          preview: "Résumé",
          description: "Résumé",
          content: [
            "Contenu traduit dynamiquement.",
          ].join("\n"),
          meaning: {
            sections: [
              { key: "audience", body: "Pour les personnes qui suivent Technologie." },
              { key: "happened", body: "Une nouvelle demande de compétences apparaît." },
              { key: "why", body: "Cela aide à ajuster les prochaines décisions." },
              { key: "practical", body: "Vérifiez une compétence cette semaine." },
            ],
          },
          source: "GNews",
          sourceUrl: "https://example.com/source",
          url: "https://example.com/source",
          publishedAt: "2026-06-01T10:00:00.000Z",
          image: "/api/news/fallback-image/technology.svg",
          category: "technology",
          sector: "Technologie",
          tags: ["Technologie"],
          relevance: 0.7,
        },
      }),
    });

    renderNewsDetail();

    expect(await screen.findByRole("heading", { name: "Actualité claire" })).toBeInTheDocument();
    expect(apiFetchMock).toHaveBeenCalledWith("/api/news/article/42?locale=fr");
    expect(screen.getByRole("heading", { name: "Pour qui" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Que faire maintenant" })).toBeInTheDocument();
  });

  it("localizes visible metadata badges and dates without translating article content", async () => {
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => key ? `dynamic:${key}` : source,
    );
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        article: {
          id: "42",
          title: "Titre deja traduit",
          preview: "Resume deja traduit",
          description: "Resume deja traduit",
          content: "Contenu deja traduit.",
          source: "GNews",
          sourceUrl: "https://example.com/source",
          url: "https://example.com/source",
          publishedAt: "2026-06-01T10:00:00.000Z",
          image: null,
          category: "technology",
          sector: "software",
          tags: ["technology", "career-growth"],
          relevance: 0.7,
        },
      }),
    });

    renderNewsDetail();

    expect(await screen.findByRole("heading", { name: "Titre deja traduit" })).toBeInTheDocument();
    expect(screen.getByText("Technologie localisee")).toBeInTheDocument();
    expect(screen.getByText("dynamic:news.detail.sector.software")).toBeInTheDocument();
    expect(screen.getByText("dynamic:news.detail.tag.technology")).toBeInTheDocument();
    expect(screen.getByText("dynamic:news.detail.tag.career-growth")).toBeInTheDocument();
    expect(screen.getByText(/juin 2026/i)).toBeInTheDocument();
    expect(screen.queryByText("technology")).not.toBeInTheDocument();
    expect(screen.queryByText("career-growth")).not.toBeInTheDocument();
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({ source: "Titre deja traduit" }));
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({ source: "Contenu deja traduit." }));
  });

  it("shows a fallback when the detail image fails to load", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        article: {
          id: "42",
          title: "ActualitÃ© claire",
          preview: "RÃ©sumÃ©",
          description: "RÃ©sumÃ©",
          content: "Contenu",
          source: "GNews",
          sourceUrl: "https://example.com/source",
          url: "https://example.com/source",
          publishedAt: "2026-06-01T10:00:00.000Z",
          image: "https://cdn.example.com/broken.jpg",
          category: "technology",
          sector: "Technologie",
          tags: ["Technologie"],
          relevance: 0.7,
        },
      }),
    });

    renderNewsDetail();

    fireEvent.error(await screen.findByRole("img", { name: "ActualitÃ© claire" }));

    expect(screen.getByTestId("news-detail-image-fallback")).toBeInTheDocument();
  });

  it("shows an accessible fallback visual when the article has no image", async () => {
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        article: {
          id: "42",
          title: "Titre sans image",
          preview: "Resume",
          description: "Resume",
          content: "Contenu",
          source: "GNews",
          sourceUrl: "https://example.com/source",
          url: "https://example.com/source",
          publishedAt: "2026-06-01T10:00:00.000Z",
          image: null,
          category: "technology",
          sector: "Technologie",
          tags: ["Technologie"],
          relevance: 0.7,
        },
      }),
    });

    renderNewsDetail();

    expect(await screen.findByRole("img", { name: "Titre sans image" })).toBeInTheDocument();
    expect(screen.getByTestId("news-detail-image-fallback")).toBeInTheDocument();
  });

  it("shows a language-specific unavailable state when the translated article cannot be served", async () => {
    i18nLanguageMock.value = "en";
    apiFetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({
        error: "news_translation_unavailable",
        requestedLocale: "en",
      }),
    });

    renderNewsDetail();

    expect(await screen.findByText("news.translationUnavailable.title")).toBeInTheDocument();
    expect(screen.getByText("news.translationUnavailable.desc")).toBeInTheDocument();
    expect(screen.queryByText("news.detail.unavailableTitle")).not.toBeInTheDocument();
  });
});
