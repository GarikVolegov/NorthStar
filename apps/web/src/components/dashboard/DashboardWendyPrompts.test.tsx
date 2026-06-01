import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardWendyPrompts } from "./DashboardWendyPrompts";

const wendyMock = vi.hoisted(() => ({
  ask: vi.fn(),
  open: vi.fn(),
}));
const i18nState = vi.hoisted(() => ({
  language: "it",
  resolvedLanguage: "it",
}));

vi.mock("@/contexts/WendyProvider", () => ({
  useOptionalWendy: () => wendyMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: i18nState,
  }),
}));

function getFirstPromptButton(): HTMLElement {
  const firstPrompt = screen.getAllByRole("button")[0];
  if (!firstPrompt) throw new Error("Expected at least one Wendy prompt button");
  return firstPrompt;
}

describe("DashboardWendyPrompts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.language = "it";
    i18nState.resolvedLanguage = "it";
  });

  it("promotes a phase-specific Wendy prompt for choosing sector and role", async () => {
    render(<DashboardWendyPrompts adaptivePhase="explore_sectors" />);

    const firstPrompt = getFirstPromptButton();
    expect(firstPrompt).toHaveTextContent(/scegli settore e ruolo/i);

    fireEvent.click(firstPrompt);

    await waitFor(() => {
      expect(wendyMock.ask).toHaveBeenCalledWith(expect.stringMatching(/settore/i));
      expect(wendyMock.ask).toHaveBeenCalledWith(expect.stringMatching(/ruolo/i));
      expect(wendyMock.open).toHaveBeenCalled();
    });
  });

  it("promotes a path choice prompt when the user is ready to choose", () => {
    render(<DashboardWendyPrompts adaptivePhase="choose_path" />);

    expect(getFirstPromptButton()).toHaveTextContent(/prepara la scelta/i);
  });

  it("sends the source prompt message to Wendy without dynamic translation", async () => {
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";
    render(<DashboardWendyPrompts adaptivePhase="explore_sectors" />);

    fireEvent.click(getFirstPromptButton());

    await waitFor(() => {
      expect(wendyMock.ask).toHaveBeenCalledWith(expect.stringMatching(/settore e ruolo/i));
    });
  });
});
