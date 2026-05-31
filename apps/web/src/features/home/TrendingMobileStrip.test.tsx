import { render, screen, within } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";
import { TrendingMobileStrip } from "./TrendingMobileStrip";
import type { TrendingSector } from "./homeTypes";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock("@/lib/sector-icon", () => ({
  SectorIcon: () => <span data-testid="sector-icon" />,
}));

const makeSector = (index: number): TrendingSector => ({
  id: index,
  name: `Settore ${index}`,
  description: `Descrizione ${index}`,
  icon: "compass",
  trend: index % 2 === 0 ? "growing" : "stable",
  growthRate: 20 - index,
  avgSalaryMin: 30000 + index * 1000,
  avgSalaryMax: 50000 + index * 1000,
  automationRisk: index % 3 === 0 ? "high" : index % 2 === 0 ? "low" : "medium",
  riasecTypes: ["I"],
  weeklyPicks: index,
  totalPicks: index * 10,
});

describe("TrendingMobileStrip", () => {
  it("renders growth areas as a ranked pyramid with a horizontal base", () => {
    render(
      <TrendingMobileStrip
        sectors={Array.from({ length: 8 }, (_, index) => makeSector(index + 1))}
      />,
    );

    const pyramid = screen.getByTestId("growth-pyramid");
    const apex = within(pyramid).getByTestId("growth-pyramid-apex");
    const middle = within(pyramid).getByTestId("growth-pyramid-middle");
    const base = within(pyramid).getByTestId("growth-pyramid-base");

    expect(within(apex).getByText("Settore 1")).toBeInTheDocument();
    expect(within(middle).getByText("Settore 2")).toBeInTheDocument();
    expect(within(middle).getByText("Settore 3")).toBeInTheDocument();
    expect(within(base).getByText("Settore 4")).toBeInTheDocument();
    expect(within(base).getByText("Settore 8")).toBeInTheDocument();
    expect(within(base).queryByText("Settore 1")).not.toBeInTheDocument();
  });

  it("uses authoritative evidence labels instead of fake percentage metrics", () => {
    render(
      <TrendingMobileStrip
        sectors={Array.from({ length: 3 }, (_, index) => makeSector(index + 1))}
      />,
    );

    const pyramid = screen.getByTestId("growth-pyramid");

    expect(within(pyramid).getByText("Area guida")).toBeInTheDocument();
    expect(within(pyramid).getAllByText("Compenso indicativo").length).toBeGreaterThan(0);
    expect(within(pyramid).getAllByText("Segnale utenti").length).toBeGreaterThan(0);
    expect(pyramid).not.toHaveTextContent(/\+\d+(\.\d+)?%/);
  });
});
