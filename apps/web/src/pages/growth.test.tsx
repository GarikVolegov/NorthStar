import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Crescita from "./growth";

const authState = vi.hoisted(() => ({
  user: { id: 7, journeyType: null } as { id: number; journeyType: string | null } | null,
}));

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: authState.user,
    isLoggedIn: Boolean(authState.user),
    authReady: true,
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
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren) => <div {...props}>{children}</div>,
  },
}));

function renderGrowth() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Crescita />
    </QueryClientProvider>,
  );
}

describe("Crescita page reliability states", () => {
  beforeEach(() => {
    authState.user = { id: 7, journeyType: null };
    getJsonMock.mockReset();
  });

  it("does not promise personalized content when /per-te returns generic articles", async () => {
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/crescita/categorie")) return Promise.resolve([]);
      if (url.includes("api/crescita/per-te")) {
        return Promise.resolve({
          articles: [
            {
              id: 1,
              title: "Routine di focus",
              slug: "routine-focus",
              category: "produttivita",
              description: "Una guida pratica.",
              tags: [],
              difficulty: "base",
              readTimeMinutes: 5,
            },
          ],
          hasProfile: false,
          personalization: "generic",
        });
      }
      if (url.includes("api/crescita?limit=6")) return Promise.resolve({ articles: [] });
      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    renderGrowth();

    expect(await screen.findByText("Contenuti di crescita in evidenza")).toBeInTheDocument();
    expect(screen.queryByText("Per te")).not.toBeInTheDocument();
    expect(screen.queryByText(/Selezionati in base al tuo profilo/i)).not.toBeInTheDocument();
  });

  it("explains when a real profile has no matching personalized growth articles yet", async () => {
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/crescita/categorie")) return Promise.resolve([]);
      if (url.includes("api/crescita/per-te")) {
        return Promise.resolve({
          articles: [],
          hasProfile: true,
          personalization: "profile",
          types: ["I", "A"],
        });
      }
      if (url.includes("api/crescita?limit=6")) return Promise.resolve({ articles: [] });
      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    renderGrowth();

    expect(await screen.findByText("Profilo pronto, contenuti in arrivo")).toBeInTheDocument();
    expect(screen.getByText(/Non abbiamo ancora articoli allineati al tuo profilo Investigativo/i)).toBeInTheDocument();
    expect(screen.getByText(/Esplora tutte le aree/i)).toBeInTheDocument();
  });

  it("shows fallback growth articles as a general path, not personalized advice", async () => {
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/crescita/categorie")) return Promise.resolve([]);
      if (url.includes("api/crescita/per-te")) {
        return Promise.resolve({
          articles: [
            {
              id: -1,
              title: "Piano di crescita in 90 giorni",
              slug: "piano-crescita-90-giorni",
              category: "crescita-professionale",
              description: "Un percorso pratico in italiano.",
              tags: ["crescita"],
              difficulty: "base",
              readTimeMinutes: 6,
            },
          ],
          hasProfile: true,
          personalization: "generic",
          source: "fallback",
          status: "fallback",
          types: ["I", "A"],
        });
      }
      if (url.includes("api/crescita?limit=6")) return Promise.resolve({ articles: [] });
      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });

    renderGrowth();

    expect(await screen.findByText("Contenuti di crescita in evidenza")).toBeInTheDocument();
    expect(screen.getByText(/percorso generale/i)).toBeInTheDocument();
    expect(screen.queryByText("Per te")).not.toBeInTheDocument();
    expect(screen.queryByText(/Selezionati in base al tuo profilo/i)).not.toBeInTheDocument();
  });

  it("shows an API error state when growth content cannot be loaded", async () => {
    getJsonMock.mockRejectedValue(new Error("growth_unavailable"));

    renderGrowth();

    expect(await screen.findByText("Non riesco a caricare i contenuti di crescita adesso.")).toBeInTheDocument();
  });
});
