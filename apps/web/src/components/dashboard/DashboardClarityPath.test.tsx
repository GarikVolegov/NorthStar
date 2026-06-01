import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DashboardClarityPath } from "./DashboardClarityPath";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("DashboardClarityPath", () => {
  it("shows adaptive phase, completion count, and next action", () => {
    render(
      <DashboardClarityPath
        hasSession
        savedSectorsCount={1}
        hasDecided={false}
        currentPhaseLabel="Esplora il mondo"
      />,
    );

    expect(screen.getByText(/mappa della chiarezza/i)).toBeInTheDocument();
    expect(screen.getByText("1 / 4 step completati")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Scegli settore e ruolo" })).toHaveAttribute("href", "/settori");
  });

  it("uses the adaptive phase to mark the decision step as current", () => {
    render(
      <DashboardClarityPath
        hasSession
        savedSectorsCount={3}
        hasDecided={false}
        adaptivePhase="choose_path"
        currentPhaseLabel="Scegli il percorso"
        nextAction={{ label: "Scegli percorso", href: "/percorso" }}
      />,
    );

    expect(screen.getAllByLabelText(/decidi.*step attivo/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/confronta.*step attivo/i)).toHaveLength(0);
  });
});
