import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";

import {
  DashboardPersonality,
  buildProfileSignals,
  normalizeRiasecProfile,
  normalizeSpiritProfile,
} from "./DashboardPersonality";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("DashboardPersonality profile normalization", () => {
  it("derives RIASEC scores from primary type labels when raw scores are missing", () => {
    const profile = normalizeRiasecProfile(undefined, ["Sociale", "Investigativo"]);

    expect(profile.find((item) => item.key === "S")?.value).toBeGreaterThan(0);
    expect(profile.find((item) => item.key === "I")?.value).toBeGreaterThan(0);
    expect(profile).toHaveLength(6);
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
    expect(screen.getByText(/dimensioni motivazionali in aggiornamento/i)).toBeInTheDocument();
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

    expect(signals).toEqual(["Test", "Wendy", "Strumenti"]);
  });
});
