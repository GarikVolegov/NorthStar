import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardHero } from "./DashboardHero";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
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
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
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

  it("renders the selected journey pill through dynamic translation instead of the raw internal value", () => {
    render(
      <DashboardHero
        journeyType="dipendente"
        session={completedSession}
        isPremium={false}
        userName="Ada Lovelace"
        profilePercent={80}
        confirmedSectorName={null}
      />,
    );

    expect(screen.getByRole("link", { name: "dynamic:dashboard.hero.journey.dipendente" })).toHaveAttribute("href", "/percorso");
    expect(screen.queryByText("dipendente")).not.toBeInTheDocument();
  });

  it("treats unknown journey values as missing instead of showing raw backend data", () => {
    render(
      <DashboardHero
        journeyType="legacy_raw_value"
        session={completedSession}
        isPremium={false}
        userName="Ada Lovelace"
        profilePercent={80}
        confirmedSectorName={null}
      />,
    );

    expect(screen.getByRole("link", { name: "dynamic:dashboard.hero.chooseJourney" })).toHaveAttribute("href", "/percorso");
    expect(screen.queryByText("legacy_raw_value")).not.toBeInTheDocument();
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "dashboard.hero.default.headline",
      source: "Il tuo prossimo passo",
    }));
  });

  it("does not render a confirmed sector pill for blank sector names", () => {
    render(
      <DashboardHero
        journeyType="dipendente"
        session={completedSession}
        isPremium={false}
        userName="Ada Lovelace"
        profilePercent={100}
        confirmedSectorName="   "
        sessionId={12}
      />,
    );

    expect(screen.queryByText("dynamic:dashboard.hero.sector")).not.toBeInTheDocument();
  });
});
