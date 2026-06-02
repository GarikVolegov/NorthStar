import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Ruolo from "./ruolo";

const roleState = vi.hoisted(() => ({
  role: {
    id: 55,
    title: "Product Designer",
    sector: "Design & UX",
    description: "Progetta esperienze digitali.",
    skills: ["Figma", "Research"],
    riasecFit: ["A", "S"],
    workModes: ["ibrido"],
    salaryRange: "32k-45k",
    growthOutlook: "Alto",
    autonomyScore: 7,
    stabilityScore: 8,
    educationPaths: [],
    sectorInfo: { id: 2, name: "Design & UX", icon: "compass" } as { id: number; name: string; icon: string } | null,
  },
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetRoleDetail: () => ({ data: roleState.role, isLoading: false, error: null }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, journeyType: "indeciso" } }),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({ useWendyPageContext: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}));
vi.mock("wouter", () => ({
  Link: ({ href, children, className, ...props }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className} {...props}>{children}</a>
  ),
  useParams: () => ({ id: "55" }),
}));
vi.mock("@/components/role/TryADaySection", () => ({
  TryADaySection: () => <section>Try-a-Day mock</section>,
}));
vi.mock("@/lib/apiClient", () => ({
  getJson: vi.fn(() => Promise.resolve({
    professionId: 55, roleTitle: "Product Designer", sector: null,
    energizers: [], frictions: [], opportunities: [], curiosity: "", demand: null,
  })),
}));
vi.mock("@/lib/sector-icon", () => ({
  RIASEC_LABELS: {
    A: { label: "Artistico", desc: "Creativo" },
    S: { label: "Sociale", desc: "Persone" },
  },
  SectorIcon: () => <span data-testid="sector-icon" />,
}));

function renderRuolo() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<Ruolo />, {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe("Ruolo decision flow", () => {
  beforeEach(() => {
    roleState.role.id = 55;
    roleState.role.sectorInfo = { id: 2, name: "Design & UX", icon: "compass" };
  });

  it("links the target role to role-specific jobs with sector fallback", () => {
    renderRuolo();

    expect(screen.getByText("Settore scelto")).toBeInTheDocument();
    expect(screen.getByText("Ruolo target")).toBeInTheDocument();
    expect(screen.getByText("Competenze")).toBeInTheDocument();
    expect(screen.getByText("Lavori")).toBeInTheDocument();

    const jobsLinks = screen.getAllByRole("link", { name: /trova aziende e lavori per questo ruolo/i });
    expect(jobsLinks).toHaveLength(2);
    for (const link of jobsLinks) {
      expect(link).toHaveAttribute("href", "/lavori?professionId=55&sectorId=2");
    }
  });

  it("links to role-specific jobs without sector when sector info is absent", () => {
    roleState.role.sectorInfo = null;

    renderRuolo();

    const jobsLinks = screen.getAllByRole("link", { name: /trova aziende e lavori per questo ruolo/i });
    expect(jobsLinks[0]).toHaveAttribute("href", "/lavori?professionId=55");
  });
});
