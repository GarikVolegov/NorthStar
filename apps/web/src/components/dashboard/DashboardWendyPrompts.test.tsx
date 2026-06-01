import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardWendyPrompts } from "./DashboardWendyPrompts";

const wendyMock = vi.hoisted(() => ({
  ask: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useOptionalWendy: () => wendyMock,
}));

function getFirstPromptButton(): HTMLElement {
  const firstPrompt = screen.getAllByRole("button")[0];
  if (!firstPrompt) throw new Error("Expected at least one Wendy prompt button");
  return firstPrompt;
}

describe("DashboardWendyPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("promotes a phase-specific Wendy prompt for sector exploration", () => {
    render(<DashboardWendyPrompts adaptivePhase="explore_sectors" />);

    const firstPrompt = getFirstPromptButton();
    expect(firstPrompt).toHaveTextContent(/scegli 3 settori/i);

    fireEvent.click(firstPrompt);

    expect(wendyMock.ask).toHaveBeenCalledWith(expect.stringMatching(/tre settori/i));
    expect(wendyMock.open).toHaveBeenCalled();
  });

  it("promotes a path choice prompt when the user is ready to choose", () => {
    render(<DashboardWendyPrompts adaptivePhase="choose_path" />);

    expect(getFirstPromptButton()).toHaveTextContent(/prepara la scelta/i);
  });
});
