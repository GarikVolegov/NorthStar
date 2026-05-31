import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

function renderWithQueryClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <CommitmentReadinessWidget />
    </QueryClientProvider>,
  );
}

describe("CommitmentReadinessWidget", () => {
  it("shows a recoverable error instead of disappearing when readiness cannot load", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "down" }),
    });

    renderWithQueryClient();

    expect(await screen.findByText(/discovery engine non disponibile/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /riprova/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /apri strumenti/i })).toHaveAttribute("href", "/dashboard");
  });
});
