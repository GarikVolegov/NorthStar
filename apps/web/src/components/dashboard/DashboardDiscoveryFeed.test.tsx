import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardDiscoveryFeed, type DiscoverySector } from "./DashboardDiscoveryFeed";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const sectors: DiscoverySector[] = [
  { sectorId: 1, sectorName: "Product Design", matchScore: 94, matchReason: "Allinea creativita e ricerca utente." },
  { sectorId: 2, sectorName: "UX Research", matchScore: 91, matchReason: "Richiede curiosita e ascolto." },
  { sectorId: 3, sectorName: "Data Analysis", matchScore: 86, matchReason: "Premia metodo e precisione." },
  { sectorId: 4, sectorName: "Cybersecurity", matchScore: 82, matchReason: "Richiede attenzione costante." },
  { sectorId: 5, sectorName: "Cloud Engineering", matchScore: 79, matchReason: "Buona crescita di mercato." },
];

describe("DashboardDiscoveryFeed", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("condenses sector recommendations when presentation is compact", () => {
    render(
      <DashboardDiscoveryFeed
        sectors={sectors}
        userId={7}
        presentation={{ priority: "compact", gated: false }}
      />,
    );

    expect(screen.getByText("Product Design")).toBeInTheDocument();
    expect(screen.getByText(/94% affinita/i)).toBeInTheDocument();
    expect(screen.getByText("Data Analysis")).toBeInTheDocument();
    expect(screen.queryByText("Cybersecurity")).not.toBeInTheDocument();
    expect(screen.queryByText(/allinea creativita/i)).not.toBeInTheDocument();
  });

  it("marks the top recommendation as promoted when presentation is primary", () => {
    render(
      <DashboardDiscoveryFeed
        sectors={sectors}
        userId={7}
        presentation={{ priority: "primary", gated: false }}
      />,
    );

    expect(screen.getByLabelText(/product design.*settore promosso/i)).toHaveClass("border-primary/35");
  });
});
