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
const dynamicTranslationMock = vi.hoisted(() => vi.fn(async ({ source }: { source: string }) => source));

vi.mock("@/contexts/WendyProvider", () => ({
  useOptionalWendy: () => wendyMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: i18nState,
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  DynamicText: ({ source }: { source: string }) => <span>{source}</span>,
  getDynamicTranslation: dynamicTranslationMock,
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
    dynamicTranslationMock.mockImplementation(async ({ source }: { source: string }) => source);
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

  it("translates the prompt message dynamically before sending it to Wendy", async () => {
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";
    dynamicTranslationMock.mockResolvedValueOnce("Help me choose a sector and role from my profile.");
    render(<DashboardWendyPrompts adaptivePhase="explore_sectors" />);

    fireEvent.click(getFirstPromptButton());

    await waitFor(() => {
      expect(wendyMock.ask).toHaveBeenCalledWith("Help me choose a sector and role from my profile.");
    });
    expect(dynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      locale: "en",
      key: "dashboard.wendyPrompts.explore_sectors.message",
      source: expect.stringMatching(/settore e ruolo/i),
    }));
  });
});
