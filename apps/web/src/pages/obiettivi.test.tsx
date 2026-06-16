import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const apiState = vi.hoisted(() => ({
  getJson: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 1, name: "Ada" }, authReady: true }),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: vi.fn(),
}));

vi.mock("@/hooks/usePageModule", () => ({
  usePageModule: vi.fn(),
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

vi.mock("@/lib/apiClient", () => ({
  deleteJson: vi.fn(),
  getJson: (...args: unknown[]): unknown => apiState.getJson(...args),
  patchJson: vi.fn(),
  postJson: vi.fn(),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => ["/obiettivi", vi.fn()],
}));

import ObjectivesPage from "./obiettivi";

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <ObjectivesPage />
    </QueryClientProvider>,
  );
}

describe("ObjectivesPage", () => {
  it("groups strategic objectives by macro area and shows vertical planning horizons", async () => {
    apiState.getJson.mockResolvedValue([
      {
        id: 1,
        text: "Diventare UX Researcher",
        category: "carriera",
        progress: 35,
        completed: false,
        completedAt: null,
        dueDate: null,
        createdAt: "2026-05-27T00:00:00.000Z",
      },
      {
        id: 2,
        text: "Validare landing page",
        category: "idea_validation",
        progress: 100,
        completed: true,
        completedAt: "2026-05-27T00:00:00.000Z",
        dueDate: null,
        createdAt: "2026-05-27T00:00:00.000Z",
      },
      {
        id: 3,
        text: "Analizzare un mercato",
        category: "business",
        progress: 20,
        completed: false,
        completedAt: null,
        dueDate: null,
        createdAt: "2026-05-27T00:00:00.000Z",
      },
    ]);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Crescita professionale" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Business e mercato" })).toBeInTheDocument();
    expect(screen.getByText("Diventare UX Researcher")).toBeInTheDocument();
    expect(screen.getByText("Analizzare un mercato")).toBeInTheDocument();
    expect(screen.queryByText("Validare landing page")).not.toBeInTheDocument();
    expect(screen.getAllByText("Settimanale").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mensile").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Trimestrale").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Annuale").length).toBeGreaterThan(0);
  });
});
