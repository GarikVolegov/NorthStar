import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Lavori from "./lavori";

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 42 }, isLoggedIn: true }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderLavori() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Lavori />
    </QueryClientProvider>,
  );
}

describe("lavori page reliability states", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
  });

  it("shows a provider setup state instead of an empty or test CTA when jobs are not connected", async () => {
    getJsonMock.mockResolvedValue({
      jobs: [],
      basedOnSector: null,
      totalCount: 0,
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
    });

    renderLavori();

    expect(await screen.findByText("Offerte lavoro non ancora collegate")).toBeInTheDocument();
    expect(screen.queryByText(/Completa il test di orientamento/i)).not.toBeInTheDocument();
  });

  it("shows the personalization CTA when jobs are empty because the user has no sector match yet", async () => {
    getJsonMock.mockResolvedValue({
      jobs: [],
      basedOnSector: null,
      totalCount: 0,
      status: "empty",
    });

    renderLavori();

    expect(await screen.findByText(/Completa il test di orientamento/i)).toBeInTheDocument();
    expect(screen.queryByText("Offerte lavoro non ancora collegate")).not.toBeInTheDocument();
  });

  it("shows a recoverable API error instead of the provider setup state when jobs loading fails", async () => {
    getJsonMock.mockRejectedValue(new Error("jobs_unavailable"));

    renderLavori();

    expect(await screen.findByText("Offerte non disponibili")).toBeInTheDocument();
    expect(screen.getByText("jobs_unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
    expect(screen.queryByText("Offerte lavoro non ancora collegate")).not.toBeInTheDocument();
  });
});
