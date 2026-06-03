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

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
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

    expect(screen.getByText("dynamic:dashboard.clarityPath.kicker")).toBeInTheDocument();
    expect(screen.getByText("1 / 4 dynamic:dashboard.clarityPath.completedCount")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dynamic:dashboard.clarityPath.steps.explore.cta" })).toHaveAttribute("href", "/settori");
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

    expect(screen.getAllByLabelText(/dynamic:dashboard\.clarityPath\.steps\.decide\.label.*dynamic:dashboard\.clarityPath\.activeStepAria/i).length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/dynamic:dashboard\.clarityPath\.steps\.compare\.label.*dynamic:dashboard\.clarityPath\.activeStepAria/i)).toHaveLength(0);
  });

  it("uses the active journey next action after a path has been chosen", () => {
    render(
      <DashboardClarityPath
        hasSession
        savedSectorsCount={3}
        hasDecided
        adaptivePhase="active_journey"
        currentPhaseLabel="Percorso attivo"
        nextAction={{ label: "Apri prossima routine", href: "/dashboard" }}
      />,
    );

    expect(screen.getByRole("link", { name: "dynamic:dashboard.clarityPath.nextAction.active_journey" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryAllByLabelText(/dynamic:dashboard\.clarityPath\.steps\.discover\.label.*dynamic:dashboard\.clarityPath\.activeStepAria/i)).toHaveLength(0);
  });
});
