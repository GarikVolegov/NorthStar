import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardCareerComparison } from "./DashboardCareerComparison";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("DashboardCareerComparison", () => {
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

    expect(screen.getByText(/confronto carriere bloccato/i)).toBeInTheDocument();
    expect(screen.getByText(/salva almeno 3 settori/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /esplora e salva settori/i })).toHaveAttribute("href", "/settori");
  });

  it("renders a compact summary when comparison is only supporting context", () => {
    render(
      <DashboardCareerComparison
        sectorA={sectorA}
        sectorB={sectorB}
        presentation={{ priority: "compact", gated: false }}
      />,
    );

    expect(screen.getByText(/confronto rapido/i)).toBeInTheDocument();
    expect(screen.getByText("Product Design")).toBeInTheDocument();
    expect(screen.getByText("UX Research")).toBeInTheDocument();
    expect(screen.getByText(/91% affinita/i)).toBeInTheDocument();
    expect(screen.queryByText(/stipendio/i)).not.toBeInTheDocument();
  });

  it("emphasizes the full comparison when it is the primary next action", () => {
    render(
      <DashboardCareerComparison
        sectorA={sectorA}
        sectorB={sectorB}
        presentation={{ priority: "primary", gated: false }}
      />,
    );

    expect(screen.getByLabelText(/confronto carriere.*azione principale/i)).toHaveClass("border-primary/35");
  });
});
