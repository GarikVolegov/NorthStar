import { render, screen } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import Sector from "./sector";

const sectorState = vi.hoisted(() => ({
  sector: {
    id: 2,
    name: "Design & UX",
    description: "Progetta esperienze digitali.",
    icon: "compass",
    riasecTypes: ["A", "S"],
    trend: "growing",
    workMode: ["autonomo"],
    advantages: [],
    disadvantages: [],
    opportunities: [],
    skills: ["Figma", "Research"],
    timeToAutonomy: "6 mesi",
    dipendentiSteps: [],
    freelanceSteps: [],
  },
  roles: [
    {
      id: 55,
      title: "Product Designer",
      description: "Progetta prodotti digitali.",
      skills: ["Figma", "Research"],
      salaryRange: "32k-45k",
      growthOutlook: "Alto",
    },
  ],
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetSector: () => ({ data: sectorState.sector, isLoading: false, error: null }),
  useGetSectorRoles: () => ({ data: sectorState.roles, isLoading: false }),
  useGetSectorStats: () => ({ data: null, isLoading: false }),
}));

vi.mock("@/components/WorkModeSelector", () => ({
  WorkModeBadge: () => <span>autonomo</span>,
  useWorkPreference: () => ({ workPreference: "autonomo" }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7, journeyType: "indeciso" } }),
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useWendy: () => ({ open: vi.fn() }),
}));

vi.mock("@/features/sector/SectorCharts", () => ({
  CareerStepList: () => <div>career steps</div>,
  GrowthChart: () => <div>growth chart</div>,
}));

vi.mock("@/features/sector/SectorPremiumTools", () => ({
  SectorPremiumTools: () => <section>premium tools</section>,
}));

vi.mock("@/features/sector/SectorSummarySections", () => ({
  SectorCompareCta: () => <section>compare cta</section>,
  SectorFreshness: () => <section>freshness</section>,
  SectorKeyMetrics: () => <section>metrics</section>,
  WorkModeAlignmentBadge: () => <span>alignment</span>,
}));

vi.mock("@/features/sector/SectorStates", () => ({
  SectorErrorState: () => <div>error</div>,
  SectorLoadingState: () => <div>loading</div>,
}));

vi.mock("@/features/sector-vitals/CompareDrawer", () => ({
  CompareDrawer: () => null,
}));

vi.mock("@/features/sector-vitals/VitalSignsRow", () => ({
  VitalSignsRow: () => <section>vitals</section>,
}));

vi.mock("@/hooks/useWendyPageContext", () => ({ useWendyPageContext: vi.fn() }));

vi.mock("@/lib/career-steps-utils", () => ({
  getCareerStepGroup: () => "design",
}));

vi.mock("@/lib/sector-icon", () => ({
  RIASEC_LABELS: {
    A: { label: "Artistico" },
    S: { label: "Sociale" },
  },
  SectorIcon: () => <span data-testid="sector-icon" />,
}));

vi.mock("@/lib/seo", () => ({
  buildSectorMeta: () => ({ title: "Design & UX" }),
  usePageMeta: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    className,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className} {...props}>
      {children}
    </a>
  ),
  useParams: () => ({ id: "2" }),
}));

describe("Sector role decision flow", () => {
  it("promotes role choice before the deep browsing tabs", async () => {
    render(<Sector />);

    expect(await screen.findByText("Scegli il ruolo target")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /scegli questo ruolo product designer/i }))
      .toHaveAttribute("href", "/ruolo/55?fromSector=2");
    expect(screen.getByRole("link", { name: "Approfondisci" }))
      .toHaveAttribute("href", "/ruolo/55");
  });
});
