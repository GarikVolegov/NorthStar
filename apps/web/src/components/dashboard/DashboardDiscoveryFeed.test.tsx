import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardDiscoveryFeed, type DiscoverySector } from "./DashboardDiscoveryFeed";

const i18nState = vi.hoisted(() => ({
  language: "en-US",
  resolvedLanguage: "en-US",
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: i18nState,
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
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
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";
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
    expect(screen.getByText(/94% dynamic:dashboard\.discoveryFeed.matchBadge/i)).toBeInTheDocument();
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

    expect(screen.getByLabelText(/product design.*dynamic:dashboard\.discoveryFeed.promotedAria/i)).toHaveClass("border-primary/35");
  });

  it("links every sector recommendation to the role choice step", () => {
    render(<DashboardDiscoveryFeed sectors={sectors} userId={7} />);

    const roleLinks = screen.getAllByRole("link", { name: /dynamic:dashboard\.discoveryFeed.openRoles/i });
    expect(roleLinks[0]).toHaveAttribute("href", "/settore/1#ruoli");
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.discoveryFeed.chooseSectorRole/i })).toHaveAttribute("href", "/settori");
  });

  it("renders discovery copy, actions, and match reasons through dynamic translation", () => {
    render(<DashboardDiscoveryFeed sectors={sectors} userId={7} />);

    expect(screen.getByText("dynamic:dashboard.discoveryFeed.sectors.1.matchReason")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "dynamic:dashboard.discoveryFeed.actions.save" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "dynamic:dashboard.discoveryFeed.actions.dismiss" }).length).toBeGreaterThan(0);
  });

  it("renders the empty state through dynamic translation", () => {
    render(<DashboardDiscoveryFeed sectors={[]} userId={7} />);

    expect(screen.getByText("dynamic:dashboard.discoveryFeed.empty.title")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.discoveryFeed.empty.cta/i })).toHaveAttribute("href", "/test");
  });
});
