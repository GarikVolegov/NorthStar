import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
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

function marketSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: 12,
    title: "UX Designer",
    company: "Adzuna - 128 segnali",
    location: "Italia",
    type: "market-signal",
    sector: "Design & UX",
    tags: ["figma", "research"],
    url: "https://www.linkedin.com/jobs/search/?keywords=UX+Designer&location=Italia",
    salary: "32.000 - 45.000 EUR",
    matchScore: 91,
    sourceLabel: "Adzuna",
    count: 128,
    period: "2026-06",
    growthRate: 0.12,
    isAggregate: true,
    ...overrides,
  };
}

describe("lavori page reliability states", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
  });

  it("shows a provider setup state instead of pretending market snapshots are real job ads", async () => {
    getJsonMock.mockResolvedValue({
      jobs: [],
      basedOnSector: null,
      totalCount: 0,
      status: "not_configured",
      reason: "jobs_provider_not_connected",
      action: "connect_jobs_provider",
      personalized: false,
      source: "job_posting_snapshots",
      period: null,
    });

    renderLavori();

    expect(await screen.findByText("Snapshot mercato non ancora collegati")).toBeInTheDocument();
    expect(screen.queryByText(/Completa il test di orientamento/i)).not.toBeInTheDocument();
  });

  it("renders aggregated market signals with count, period and skills", async () => {
    getJsonMock.mockResolvedValue({
      jobs: [marketSignal()],
      basedOnSector: "Design & UX",
      totalCount: 1,
      status: "ok",
      personalized: true,
      source: "job_posting_snapshots",
      period: "2026-06",
    });

    renderLavori();

    expect(await screen.findByText("UX Designer")).toBeInTheDocument();
    expect(screen.getByText("Design & UX - Adzuna")).toBeInTheDocument();
    expect(screen.getByText("128 segnali aggregati")).toBeInTheDocument();
    expect(screen.getByText("2026-06")).toBeInTheDocument();
    expect(screen.getByText("figma")).toBeInTheDocument();
    expect(screen.getByText("Priorita mercato/profilo")).toBeInTheDocument();
  });

  it("shows the personalization CTA when snapshots exist but the user has no sector match yet", async () => {
    getJsonMock.mockResolvedValue({
      jobs: [],
      basedOnSector: null,
      totalCount: 0,
      status: "empty",
      personalized: false,
      source: "job_posting_snapshots",
      period: null,
    });

    renderLavori();

    expect(await screen.findByText("Nessuno snapshot disponibile")).toBeInTheDocument();
    expect(screen.getByText(/Completa il test di orientamento/i)).toBeInTheDocument();
    expect(screen.queryByText("Snapshot mercato non ancora collegati")).not.toBeInTheDocument();
  });

  it("shows an empty-filter state when filters exclude all available market signals", async () => {
    getJsonMock.mockResolvedValue({
      jobs: [marketSignal({ count: 12, growthRate: 0 })],
      basedOnSector: "Design & UX",
      totalCount: 1,
      status: "ok",
      personalized: true,
      source: "job_posting_snapshots",
      period: "2026-06",
    });

    renderLavori();

    fireEvent.click(await screen.findByRole("button", { name: "Alta domanda" }));

    expect(await screen.findByText("Nessun segnale con questi filtri")).toBeInTheDocument();
    expect(screen.getByText(/Prova a tornare su "Tutti"/i)).toBeInTheDocument();
  });

  it("shows a recoverable API error instead of leaking the technical exception as primary copy", async () => {
    getJsonMock.mockRejectedValue(new Error("jobs_unavailable"));

    renderLavori();

    expect(await screen.findByText("Snapshot mercato non disponibili")).toBeInTheDocument();
    expect(screen.getByText("Non siamo riusciti a caricare i dati aggregati del mercato lavoro. Riprova tra poco.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Riprova" })).toBeInTheDocument();
    expect(screen.queryByText("jobs_unavailable")).not.toBeInTheDocument();
  });
});
