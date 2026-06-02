import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CrescitaCategoria from "./crescita-categoria";

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
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
  useParams: () => ({ cat: "focus" }),
}));

function renderCategory() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <CrescitaCategoria />
    </QueryClientProvider>,
  );
}

describe("CrescitaCategoria server-backed filtering", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/crescita/categorie")) {
        return Promise.resolve([
          {
            id: "focus",
            label: "Focus",
            icon: "F",
            description: "Allenare attenzione e priorita.",
            count: 1,
          },
        ]);
      }

      if (url.includes("api/crescita?")) {
        return Promise.resolve({
          articles: [
            {
              id: 10,
              title: "Allenare il focus",
              slug: "allenare-focus",
              category: "focus",
              description: "Una guida pratica.",
              tags: ["focus"],
              difficulty: "base",
              readTimeMinutes: 4,
              viewCount: 12,
              sourceLabel: "Biblioteca crescita",
              personalization: "generic",
              reasonLabels: ["Tema: focus"],
            },
          ],
          total: 1,
        });
      }

      return Promise.reject(new Error(`Unhandled URL ${url}`));
    });
  });

  it("requests server-side search and keeps discovery metadata visible", async () => {
    renderCategory();

    expect(await screen.findByText("Allenare il focus")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Cerca articoli/i), {
      target: { value: "leadership" },
    });

    await waitFor(() => {
      expect(
        getJsonMock.mock.calls.some(([url]) => String(url).includes("search=leadership")),
      ).toBe(true);
    });

    expect(await screen.findByText("Biblioteca crescita")).toBeInTheDocument();
    expect(screen.getByText("Tema: focus")).toBeInTheDocument();
  });

  it("requests server-side difficulty filtering", async () => {
    renderCategory();

    await screen.findByText("Allenare il focus");

    fireEvent.click(screen.getByRole("button", { name: "Base" }));

    await waitFor(() => {
      expect(
        getJsonMock.mock.calls.some(([url]) => String(url).includes("difficulty=base")),
      ).toBe(true);
    });
  });
});
