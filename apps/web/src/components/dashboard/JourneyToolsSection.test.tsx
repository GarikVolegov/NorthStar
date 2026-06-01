import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { JourneyToolsSection } from "./JourneyToolsSection";

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("JourneyToolsSection", () => {
  it("condenses tools when the adaptive presentation is compact", () => {
    render(
      <JourneyToolsSection
        journeyType="indeciso"
        adaptivePhase="explore_sectors"
        presentation={{ priority: "compact", gated: false }}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /esplora settori/i })).toBeInTheDocument();
    expect(screen.queryByText(/notizie lavoro/i)).not.toBeInTheDocument();
  });

  it("marks the phase tool as the emphasized card when presentation is primary", () => {
    render(
      <JourneyToolsSection
        journeyType="indeciso"
        adaptivePhase="choose_path"
        presentation={{ priority: "primary", gated: false }}
      />,
    );

    const choosePathLink = screen.getByRole("link", { name: /scegli percorso/i });
    expect(choosePathLink.firstElementChild).toHaveClass("sm:col-span-2");
  });
});
