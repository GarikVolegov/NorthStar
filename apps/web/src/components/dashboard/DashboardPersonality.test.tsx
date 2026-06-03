import { render, screen } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DashboardPersonality,
  buildProfileSignals,
  normalizeRiasecProfile,
  normalizeSpiritProfile,
} from "./DashboardPersonality";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "it",
      resolvedLanguage: "en-US",
    },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("DashboardPersonality profile normalization", () => {
  beforeEach(() => {
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
  });

  it("keeps primary type labels qualitative when raw RIASEC scores are missing", () => {
    const profile = normalizeRiasecProfile(undefined, ["Sociale", "Investigativo"]);

    expect(profile.find((item) => item.key === "S")?.value).toBe(0);
    expect(profile.find((item) => item.key === "I")?.value).toBe(0);
    expect(profile).toHaveLength(6);
  });

  it("ignores invalid primary type payload values instead of crashing", () => {
    expect(() => normalizeRiasecProfile(undefined, [null as unknown as string, 42 as unknown as string, "Sociale"])).not.toThrow();

    render(
      <DashboardPersonality
        primaryTypes={[null as unknown as string, 42 as unknown as string, "Sociale"]}
        spiritScores={{ Motivazione: 0 }}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.personality.primaryTypes.sociale")).toBeInTheDocument();
    expect(screen.queryByText("null")).not.toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
  });

  it("filters empty motivational dimensions instead of displaying 0.0 as real data", () => {
    const spirits = normalizeSpiritProfile({
      Motivazione: 0,
      "Pens. Analitico": 0,
      "Or. Strategico": 0,
    });

    expect(spirits).toHaveLength(0);

    render(
      <DashboardPersonality
        primaryTypes={["Sociale", "Investigativo"]}
        spiritScores={{ Motivazione: 0, "Pens. Analitico": 0, "Or. Strategico": 0 }}
      />,
    );

    expect(screen.queryByText("0.0")).not.toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.motivational.empty.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.motivational.empty.copy")).toBeInTheDocument();
  });

  it("surfaces test, Wendy and tools signals as profile inputs", () => {
    const signals = buildProfileSignals({
      hasTestProfile: true,
      agentSummary: {
        professions: [{
          title: "UX Researcher",
          sector: "Design",
          skills: ["ricerca"],
          workModes: ["ibrido"],
          salaryRange: "N/D",
          growthOutlook: "buono",
        }],
        workMode: {
          recommended: "hybrid",
          recommendedLabel: "ibrido",
          riasecFit: "alto",
        },
      },
      objectivesProgress: { total: 2, done: 1, percent: 50 },
    });

    expect(signals).toEqual(["test", "advisor", "activity"]);
  });

  it("uses design-system colors for motivational dimension meters", () => {
    render(
      <DashboardPersonality
        primaryTypes={["Sociale"]}
        spiritScores={{
          Motivazione: 4.7,
          "Pens. Analitico": 4.4,
          "Or. Strategico": 4.1,
        }}
      />,
    );

    const meters = screen.getAllByRole("meter");

    expect(meters).toHaveLength(3);
    expect(meters[0]).toHaveAccessibleName("dynamic:dashboard.personality.motivational.meterLabel");
    expect(meters.map((meter) => meter.className)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("bg-primary/70"),
        expect.stringContaining("bg-growth/70"),
        expect.stringContaining("bg-info/70"),
      ]),
    );
    for (const meter of meters) {
      expect(meter.className).not.toMatch(/bg-(violet|indigo|amber|cyan|rose)-400/);
    }
  });

  it("renders profile content through dynamic translations and practical source labels", () => {
    render(
      <DashboardPersonality
        riasecScores={{ S: 4.7, I: 4.1 }}
        primaryTypes={["Sociale", "Investigativo"]}
        spiritScores={{ Motivazione: 4.7 }}
        agentSummary={{
          professions: [{
            title: "UX Researcher",
            sector: "Design",
            skills: ["ricerca"],
            workModes: ["ibrido"],
            salaryRange: "N/D",
            growthOutlook: "buono",
          }],
          workMode: {
            recommended: "hybrid",
            recommendedLabel: "ibrido",
            riasecFit: "alto",
          },
        }}
        objectivesProgress={{ total: 1, done: 0, percent: 0 }}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.personality.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.sources.test")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.sources.advisor")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.sources.activity")).toBeInTheDocument();
    expect(screen.getByText(/dynamic:dashboard\.personality\.recommendation\.directionLabel/)).toBeInTheDocument();
    expect(screen.getByText(/dynamic:dashboard\.personality\.recommendation\.workModeLabel/)).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.riasec.heading")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.motivational.heading")).toBeInTheDocument();
    expect(screen.getByText(/dynamic:dashboard\.personality\.riasec\.S/)).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.motivational.po")).toBeInTheDocument();
    expect(screen.queryByText(/Da Wendy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Da Strumenti/i)).not.toBeInTheDocument();
  });

  it("uses dynamic copy and keyboard focus styles in the empty state", () => {
    render(<DashboardPersonality />);

    expect(screen.getByText("dynamic:dashboard.personality.empty.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.personality.empty.copy")).toBeInTheDocument();
    expect(screen.queryByText(/Profilo non disponibile/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Completa il test/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.personality\.empty\.cta/i })).toHaveClass("focus-visible:ring-2");
  });
});
