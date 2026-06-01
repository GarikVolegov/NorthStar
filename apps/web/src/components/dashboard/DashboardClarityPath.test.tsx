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
        nextAction={{ label: "Esplora settori", href: "/settori" }}
      />,
    );

    expect(screen.getByText(/mappa della chiarezza/i)).toBeInTheDocument();
    expect(screen.getByText("1 / 4 step completati")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Esplora settori" })).toHaveAttribute("href", "/settori");
  });
});
