import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NewsDetail from "./news-detail";

const apiFetchMock = vi.hoisted(() => vi.fn());
const i18nLanguageMock = vi.hoisted(() => ({ value: "fr" }));

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => ({
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
});
