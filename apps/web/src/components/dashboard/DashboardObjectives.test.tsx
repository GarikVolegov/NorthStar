import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardDiaryBookCard } from "./DashboardObjectives";

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "en-US",
      resolvedLanguage: "en-US",
    },
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

const baseObjective = {
  id: 1,
  text: "Diventare UX Researcher",
  category: "carriera",
  progress: 25,
  completed: false,
  completedAt: null,
  isCertifiableMilestone: false,
  dueDate: "2026-06-10",
  createdAt: "2026-05-27T00:00:00.000Z",
};

describe("DashboardObjectives", () => {
  it("renders an accessible diary book card for dashboard goals", () => {
    render(
      <DashboardDiaryBookCard
        objectives={[
          baseObjective,
          {
            ...baseObjective,
            id: 2,
            text: "Costruire portfolio",
            progress: 50,
          },
          { ...baseObjective, id: 3, text: "Inviare candidature", progress: 0 },
          { ...baseObjective, id: 4, text: "Simulare colloqui", progress: 10 },
          {
            ...baseObjective,
            id: 5,
            text: "Mappare aziende target",
            progress: 80,
          },
        ]}
      />,
    );

    expect(
      screen.getByRole("link", { name: /dynamic:dashboard\.objectivesCard\.ariaLabel/i }),
    ).toHaveAttribute("href", "/diario?tab=objectives");
    expect(screen.getByText("dynamic:dashboard.objectivesCard.title")).toBeInTheDocument();
    expect(screen.getByTestId("diary-book-cover")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.objectivesCard.progressLabel")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.objectivesCard.nextFocus")).toBeInTheDocument();
    expect(screen.getByText("5 dynamic:dashboard.objectivesCard.activePlural")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.objectivesCard.macroAreas.professional.label")).toBeInTheDocument();
    expect(screen.getByText("Diventare UX Researcher")).toBeInTheDocument();
    expect(
      screen.queryByText("Mappare aziende target"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Settimanale")).not.toBeInTheDocument();
    expect(screen.queryByText("Mensile")).not.toBeInTheDocument();
    expect(screen.queryByText("Trimestrale")).not.toBeInTheDocument();
    expect(screen.queryByText("Annuale")).not.toBeInTheDocument();
  });

  it("shows practical empty guidance when no strategic objectives exist", () => {
    render(
      <DashboardDiaryBookCard
        objectives={[{
          ...baseObjective,
          id: 2,
          text: "Test landing page idea",
          category: "idea_validation",
          progress: 100,
        }]}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.objectivesCard.empty.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.objectivesCard.empty.copy")).toBeInTheDocument();
    expect(screen.queryByText("0 / 0 completati")).not.toBeInTheDocument();
    expect(screen.queryByText("0 attivi")).not.toBeInTheDocument();
    expect(screen.queryByText("Test landing page idea")).not.toBeInTheDocument();
  });

  it("keeps idea validation tasks out of the dashboard gauge and path", () => {
    render(
      <DashboardDiaryBookCard
        objectives={[
          baseObjective,
          {
            ...baseObjective,
            id: 2,
            text: "Test landing page idea",
            category: "idea_validation",
            progress: 100,
          },
        ]}
      />,
    );

    expect(screen.getByText("Diventare UX Researcher")).toBeInTheDocument();
    expect(
      screen.queryByText("Test landing page idea"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
