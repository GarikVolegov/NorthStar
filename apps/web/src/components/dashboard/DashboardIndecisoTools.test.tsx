import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardIndecisoTools } from "./DashboardIndecisoTools";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderWithClient(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <DashboardIndecisoTools toolsProps={{ journeyType: "indeciso" }} />
    </QueryClientProvider>,
  );
}

describe("DashboardIndecisoTools", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        score: 55,
        band: "mid",
        components: {
          selfKnowledge: 10,
          exploration: 10,
          reflection: 10,
          emotion: 8,
          commitment: 3,
        },
        nextNudge: null,
      }),
    });
  });

  it("does not band tools from incomplete shared readiness cache data", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(["discovery-readiness"], { band: "low" });

    renderWithClient(client);

    expect(screen.getByText(/discovery engine non disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/test di personalit/i)).toBeInTheDocument();
  });
});
