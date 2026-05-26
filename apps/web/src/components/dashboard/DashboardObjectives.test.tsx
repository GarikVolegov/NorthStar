import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardObjectivesPathCard } from "./DashboardObjectives";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const baseObjective = {
  id: 1,
  text: "Diventare UX Researcher",
  category: "carriera",
  progress: 25,
  completed: false,
  completedAt: null,
  dueDate: "2026-06-10",
  createdAt: "2026-05-27T00:00:00.000Z",
};

describe("DashboardObjectives", () => {
  it("renders a compact clickable path card for dashboard goals", () => {
    render(
      <DashboardObjectivesPathCard
        objectives={[
          baseObjective,
          { ...baseObjective, id: 2, text: "Costruire portfolio", progress: 50 },
          { ...baseObjective, id: 3, text: "Inviare candidature", progress: 0 },
          { ...baseObjective, id: 4, text: "Simulare colloqui", progress: 10 },
          { ...baseObjective, id: 5, text: "Mappare aziende target", progress: 80 },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /apri pagina obiettivi/i })).toHaveAttribute("href", "/obiettivi");
    expect(screen.getByText("Obiettivi")).toBeInTheDocument();
    expect(screen.getByText("Diventare UX Researcher")).toBeInTheDocument();
    expect(screen.queryByText("Mappare aziende target")).not.toBeInTheDocument();
    expect(screen.queryByText("Settimanale")).not.toBeInTheDocument();
    expect(screen.queryByText("Mensile")).not.toBeInTheDocument();
    expect(screen.queryByText("Trimestrale")).not.toBeInTheDocument();
    expect(screen.queryByText("Annuale")).not.toBeInTheDocument();
  });

  it("keeps idea validation tasks out of the dashboard gauge and path", () => {
    render(
      <DashboardObjectivesPathCard
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
    expect(screen.queryByText("Test landing page idea")).not.toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });
});
