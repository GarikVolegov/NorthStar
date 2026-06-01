import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Lavori from "./lavori";

const getJsonMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  isLoggedIn: true,
  user: { id: 42 } as { id: number } | null,
}));

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user, isLoggedIn: authState.isLoggedIn }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderLavori(path = "/lavori") {
  window.history.replaceState({}, "", path);
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

function jobsResponse(overrides: Record<string, unknown> = {}) {
  return {
    jobs: [marketSignal({ title: "Product Designer" })],
    basedOnProfession: "Product Designer",
    basedOnSector: "Design & UX",
    totalCount: 1,
    status: "ok",
    personalized: true,
    source: "job_posting_snapshots",
    period: "2026-06",
    filter: { professionId: 55, sectorId: 2, fallback: null },
    ...overrides,
  };
}

function companiesResponse(overrides: Record<string, unknown> = {}) {
  return {
    companies: [{
      name: "Studio Forma",
      location: "Milano",
      reason: "Lavora su prodotti digitali e design.",
      evidence: "Pagina careers pubblica collegata a Product Designer.",
      sourceUrl: "https://example.com/studio-forma",
      sourceLabel: "example.com",
      confidence: "medium",
      suggestedSearchUrl: "https://www.google.com/search?q=Studio%20Forma%20Product%20Designer",
    }],
    basedOnProfession: "Product Designer",
    basedOnSector: "Design & UX",
    basedOnCity: "Milano",
    status: "ok",
    coverageNote: "Mostro aziende scoperte dalle fonti configurate e disponibili.",
    ...overrides,
  };
}

function mockRoleAwareApi(
  jobs = jobsResponse(),
  companies = companiesResponse(),
) {
  getJsonMock.mockImplementation((path: string) => {
    if (path.startsWith("/api/jobs/company-prospects")) return Promise.resolve(companies);
    if (path.startsWith("/api/jobs")) return Promise.resolve(jobs);
    return Promise.reject(new Error(`Unexpected path ${path}`));
  });
}

describe("lavori page role context", () => {
  beforeEach(() => {
    authState.isLoggedIn = true;
    authState.user = { id: 42 };
    getJsonMock.mockReset();
    mockRoleAwareApi();
  });

  it("requests jobs and company prospects with profession and sector context", async () => {
    renderLavori("/lavori?professionId=55&sectorId=2");

    expect(await screen.findByText("Aziende e lavori per Product Designer a Milano")).toBeInTheDocument();

    expect(getJsonMock).toHaveBeenCalledWith("/api/jobs?professionId=55&sectorId=2");
    expect(getJsonMock).toHaveBeenCalledWith("/api/jobs/company-prospects?professionId=55&sectorId=2");
    expect(screen.getByText("Studio Forma")).toBeInTheDocument();
    expect(screen.getByText(/aziende scoperte dalle fonti/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /fonte: example.com/i })).toHaveAttribute("href", "https://example.com/studio-forma");
    expect(screen.getByRole("link", { name: /cerca posizioni aperte/i })).toHaveAttribute("href", "https://www.google.com/search?q=Studio%20Forma%20Product%20Designer");
  });

  it("passes query city to company prospect search", async () => {
    renderLavori("/lavori?professionId=55&sectorId=2&city=Torino");

    expect(await screen.findByText("Aziende e lavori per Product Designer a Milano")).toBeInTheDocument();

    expect(getJsonMock).toHaveBeenCalledWith("/api/jobs/company-prospects?professionId=55&sectorId=2&city=Torino");
  });

  it("renders sector fallback copy when role snapshots are missing", async () => {
    mockRoleAwareApi(jobsResponse({
      basedOnProfession: null,
      filter: { professionId: 55, sectorId: 2, fallback: "sector" },
    }));

    renderLavori("/lavori?professionId=55&sectorId=2");

    expect(await screen.findByText("Aziende e lavori per Product Designer a Milano")).toBeInTheDocument();
    expect(screen.getByText(/non ho ancora snapshot specifici per questo ruolo/i)).toBeInTheDocument();
  });

  it("asks for a city when local company search has no city", async () => {
    mockRoleAwareApi(jobsResponse(), companiesResponse({
      companies: [],
      basedOnCity: null,
      status: "city_required",
    }));

    renderLavori("/lavori?professionId=55&sectorId=2");

    expect(await screen.findByText(/aggiungi una citta/i)).toBeInTheDocument();
  });

  it("shows provider setup copy when company prospect search is not configured", async () => {
    mockRoleAwareApi(jobsResponse(), companiesResponse({
      companies: [],
      status: "not_configured",
    }));

    renderLavori("/lavori?professionId=55&sectorId=2");

    expect(await screen.findByText(/richiede un provider web configurato/i)).toBeInTheDocument();
  });

  it("shows an empty company state while keeping market signals", async () => {
    mockRoleAwareApi(jobsResponse(), companiesResponse({
      companies: [],
      status: "empty",
    }));

    renderLavori("/lavori?professionId=55&sectorId=2");

    expect(await screen.findByText(/non ho trovato aziende locali/i)).toBeInTheDocument();
    expect(screen.getByText("Product Designer")).toBeInTheDocument();
  });

  it("keeps the existing auth gate for logged out users", () => {
    authState.isLoggedIn = false;
    authState.user = null;

    renderLavori("/lavori?professionId=55");

    expect(screen.getByText("Segnali mercato NorthStar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /accedi/i })).toHaveAttribute("href", "/sign-in?redirect_url=/lavori");
    expect(getJsonMock).not.toHaveBeenCalled();
  });
});

describe("lavori page reliability states", () => {
  beforeEach(() => {
    authState.isLoggedIn = true;
    authState.user = { id: 42 };
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
