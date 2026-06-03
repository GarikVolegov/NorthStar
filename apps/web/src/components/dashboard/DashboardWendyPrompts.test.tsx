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

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
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
    expect(firstPrompt).toHaveTextContent("dynamic:dashboard.wendyPrompts.prompts.explore_sectors.label");

    fireEvent.click(firstPrompt);

    await waitFor(() => {
      expect(wendyMock.ask).toHaveBeenCalledWith("dynamic:dashboard.wendyPrompts.prompts.explore_sectors.message");
      expect(wendyMock.open).toHaveBeenCalled();
    });
  });

  it("promotes a path choice prompt when the user is ready to choose", () => {
    render(<DashboardWendyPrompts adaptivePhase="choose_path" />);

    expect(getFirstPromptButton()).toHaveTextContent("dynamic:dashboard.wendyPrompts.prompts.choose_path.label");
  });

  it("promotes an active journey prompt after the user has chosen a path", () => {
    render(<DashboardWendyPrompts adaptivePhase="active_journey" />);

    const firstPrompt = getFirstPromptButton();

    expect(firstPrompt).toHaveTextContent("dynamic:dashboard.wendyPrompts.prompts.active_journey.label");
    expect(firstPrompt).not.toHaveTextContent(/notte della fondazione/i);
  });

  it("sends the dynamically translated prompt message to Wendy", async () => {
    i18nState.language = "en-US";
    i18nState.resolvedLanguage = "en-US";
    render(<DashboardWendyPrompts adaptivePhase="explore_sectors" />);

    fireEvent.click(getFirstPromptButton());

    await waitFor(() => {
      expect(wendyMock.ask).toHaveBeenCalledWith("dynamic:dashboard.wendyPrompts.prompts.explore_sectors.message");
    });
  });
});
