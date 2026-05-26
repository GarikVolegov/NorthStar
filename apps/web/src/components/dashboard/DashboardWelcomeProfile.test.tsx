import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardHero } from "./DashboardHero";
import { DashboardKpiStrip } from "./DashboardKpiStrip";

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const completedSession = {
  id: 12,
  riasecScores: { S: 4.4, I: 4.1 },
  primaryTypes: ["Sociale", "Investigativo"],
  spiritScores: {},
  recommendations: [{ sectorId: 3, sectorName: "Design & UX", matchScore: 91 }],
  createdAt: "2026-05-26T00:00:00.000Z",
};

describe("dashboard completed profile placement", () => {
  it("hides profile completion and professional sector cards from the KPI strip when complete", () => {
    render(
      <DashboardKpiStrip
        profilePercent={100}
        objectives={[]}
        objectivesProgress={{ done: 0, total: 0, percent: 0 }}
        upcomingEvents={[]}
        confirmedSectorName="Design & UX"
        sessionId={12}
      />,
    );

    expect(screen.queryByText("Completamento profilo")).not.toBeInTheDocument();
    expect(screen.queryByText("Obiettivi")).not.toBeInTheDocument();
    expect(screen.queryByText("Settore professionale")).not.toBeInTheDocument();
  });

  it("shows only the professional sector inside the welcome card when profile is complete", () => {
    render(
      <DashboardHero
        journeyType="dipendente"
        session={completedSession}
        isPremium={false}
        userName="Ada Lovelace"
        profilePercent={100}
        confirmedSectorName="Design & UX"
        sessionId={12}
      />,
    );

    expect(screen.queryByText("Profilo completo")).not.toBeInTheDocument();
    expect(screen.getByText("Design & UX")).toBeInTheDocument();
  });
});
