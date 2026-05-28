import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const routerState = vi.hoisted(() => ({
  navigate: vi.fn(),
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

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
  useLocation: () => ["/obiettivi", routerState.navigate],
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
  it("redirects old objective links into the diary objectives tab", () => {
    renderPage();

    expect(routerState.navigate).toHaveBeenCalledWith("/diario?tab=objectives", { replace: true });
    expect(screen.getByText("Gli obiettivi ora vivono nel diario.")).toBeInTheDocument();
  });
});
