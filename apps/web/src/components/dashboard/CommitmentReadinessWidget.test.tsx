import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CommitmentReadinessWidget } from "./CommitmentReadinessWidget";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function createClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderWithQueryClient(client = createClient()) {

  return render(
    <QueryClientProvider client={client}>
      <CommitmentReadinessWidget />
    </QueryClientProvider>,
  );
}

describe("CommitmentReadinessWidget", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  it("shows a recoverable error instead of disappearing when readiness cannot load", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "down" }),
    });

    renderWithQueryClient();

    expect(await screen.findByText(/prontezza non disponibile/i)).toBeInTheDocument();
    expect(screen.getByText(/livello di prontezza/i)).toBeInTheDocument();
    expect(screen.queryByText(/readiness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/discovery engine/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /riprova/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /apri strumenti/i })).toHaveAttribute("href", "/dashboard");
  });

  it("shows a recoverable error if the shared readiness cache contains incomplete data", async () => {
    const client = createClient();
    client.setQueryData(["discovery-readiness"], { band: "low" });

    renderWithQueryClient(client);

    expect(await screen.findByText(/prontezza non disponibile/i)).toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });

  it("uses simple Italian wording when readiness data loads", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        score: 72,
        band: "high",
        components: {
          selfKnowledge: 20,
          exploration: 22,
          reflection: 18,
          emotion: 8,
          commitment: 4,
        },
        nextNudge: null,
      }),
    });

    renderWithQueryClient();

    expect(await screen.findByText(/prontezza alla scelta/i)).toBeInTheDocument();
    expect(screen.getByText(/72/)).toBeInTheDocument();
    expect(screen.queryByText(/readiness/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/discovery engine/i)).not.toBeInTheDocument();
  });
});
