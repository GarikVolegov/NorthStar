import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardCareerComparison } from "./DashboardCareerComparison";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "it",
      resolvedLanguage: "en-US",
    },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("DashboardCareerComparison", () => {
  beforeEach(() => {
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
  });

  const sectorA = {
    sectorId: 1,
    sectorName: "Product Design",
    matchScore: 91,
    avgSalaryMin: 32000,
    avgSalaryMax: 52000,
  };
  const sectorB = {
    sectorId: 2,
    sectorName: "UX Research",
    matchScore: 88,
    avgSalaryMin: 30000,
    avgSalaryMax: 50000,
  };

  it("shows a gated prerequisite state before the user saves enough sectors", () => {
    render(
      <DashboardCareerComparison
        sectorA={{ sectorId: 1, sectorName: "Product Design", matchScore: 91 }}
        sectorB={{ sectorId: 2, sectorName: "UX Research", matchScore: 88 }}
        presentation={{ priority: "supporting", gated: true }}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.careerComparison.gated.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.gated.copy")).toBeInTheDocument();
    expect(screen.queryByText(/discovery/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.careerComparison\.gated\.cta/i })).toHaveAttribute("href", "/settori");
  });

  it("renders a compact summary when comparison is only supporting context", () => {
    render(
      <DashboardCareerComparison
        sectorA={sectorA}
        sectorB={sectorB}
        presentation={{ priority: "compact", gated: false }}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.careerComparison.compact.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.compact.subtitle")).toBeInTheDocument();
    expect(screen.getByText("Product Design")).toBeInTheDocument();
    expect(screen.getByText("UX Research")).toBeInTheDocument();
    expect(screen.getByText(/91% dynamic:dashboard\.careerComparison\.matchLabel/i)).toBeInTheDocument();
    expect(screen.queryByText("Stipendio")).not.toBeInTheDocument();
  });

  it("emphasizes the full comparison when it is the primary next action", () => {
    render(
      <DashboardCareerComparison
        sectorA={sectorA}
        sectorB={sectorB}
        presentation={{ priority: "primary", gated: false }}
      />,
    );

    expect(screen.getByLabelText(/dynamic:dashboard\.careerComparison\.ariaLabel.*dynamic:dashboard\.careerComparison\.primaryAriaSuffix/i)).toHaveClass("border-primary/35");
  });

  it("shows an insufficient-data state instead of crashing when the first sector is missing", () => {
    render(
      <DashboardCareerComparison
        sectorA={null}
        sectorB={sectorB}
        presentation={{ priority: "primary", gated: false }}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.careerComparison.partial.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.partial.copy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.careerComparison\.partial\.cta/i })).toHaveAttribute("href", "/settori");
    expect(screen.queryByText(/UX Research.*VS/i)).not.toBeInTheDocument();
  });

  it("translates metrics, enum labels and unavailable fallbacks in the full comparison", () => {
    render(
      <DashboardCareerComparison
        sectorA={{
          sectorId: sectorA.sectorId,
          sectorName: sectorA.sectorName,
          matchScore: sectorA.matchScore,
          trend: "growing",
          automationRisk: "low",
          stabilityScore: 8,
        }}
        sectorB={{
          ...sectorB,
          trend: "booming",
          autonomyScore: 6,
        }}
        presentation={{ priority: "primary", gated: false }}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.careerComparison.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.subtitle")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.metrics.salary")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.metrics.trend")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.metrics.automation")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.metrics.autonomy")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.metrics.stability")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.trends.growing")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.trends.booming")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.careerComparison.risks.low")).toBeInTheDocument();
    expect(screen.getAllByText("dynamic:dashboard.careerComparison.unavailable")).toHaveLength(4);
    expect(screen.queryByText("N/D")).not.toBeInTheDocument();
    expect(screen.queryByText("growing")).not.toBeInTheDocument();
    expect(screen.queryByText("booming")).not.toBeInTheDocument();
  });
});
