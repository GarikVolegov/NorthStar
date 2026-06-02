import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardHero } from "./DashboardHero";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
}));

vi.mock("wouter", () => ({
  Link: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const completedSession = {
  id: 12,
  riasecScores: { S: 4.4, I: 4.1 },
  primaryTypes: ["Sociale", "Investigativo"],
  spiritScores: {},
  recommendations: [{ sectorId: 3, sectorName: "Design & UX", matchScore: 91 }],
  createdAt: "2026-05-26T00:00:00.000Z",
};

describe("DashboardHero dynamic translations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-02T09:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders journey hero copy through dynamic translation", () => {
    render(
      <DashboardHero
        journeyType="indeciso"
        session={completedSession}
        isPremium={false}
        userName="Ada Lovelace"
        profilePercent={80}
        confirmedSectorName={null}
        clarityScore={64}
      />,
    );

    expect(screen.getByText(/dynamic:dashboard\.hero\.greeting\.morning/)).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.hero.indeciso.headline")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.hero.indeciso.subline")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.hero.clarity")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dynamic:dashboard.hero.chooseSectorRoleJobs" })).toHaveAttribute("href", "/settori");
    expect(screen.queryByText("La tua bussola personale")).not.toBeInTheDocument();
    expect(screen.queryByText("Scegli settore, ruolo e lavori")).not.toBeInTheDocument();
  });
});
