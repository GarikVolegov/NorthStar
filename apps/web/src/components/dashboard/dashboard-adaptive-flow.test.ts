import { describe, expect, it } from "vitest";

import {
  deriveDashboardPhase,
  getAdaptiveDashboardLayout,
  getAdaptiveSectionPresentation,
  type AdaptiveDashboardInput,
} from "./dashboard-adaptive-flow";

const baseInput: AdaptiveDashboardInput = {
  journeyType: "indeciso",
  hasSession: false,
  savedSectorsCount: 0,
  hasDecided: false,
  layout: [
    { id: "tools", position: 0, visible: true, size: "lg" },
    { id: "clarity_path", position: 1, visible: true, size: "lg" },
    { id: "discovery_feed", position: 2, visible: true, size: "lg" },
  ],
};

describe("dashboard adaptive flow", () => {
  it("derives start_test when the indeciso user has no session", () => {
    expect(deriveDashboardPhase(baseInput)).toEqual({
      phase: "start_test",
      nextAction: {
        label: "Inizia il test",
        href: "/test",
        sectionId: "clarity_path",
      },
    });
  });

  it("derives explore_sectors after the test and before three saved sectors", () => {
    const result = deriveDashboardPhase({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 1,
    });

    expect(result.phase).toBe("explore_sectors");
    expect(result.nextAction).toEqual({
      label: "Esplora settori",
      href: "/settori",
      sectionId: "discovery_feed",
    });
  });

  it("derives compare_options after three saved sectors when readiness is not high", () => {
    const result = deriveDashboardPhase({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 3,
      readinessBand: "mid",
    });

    expect(result.phase).toBe("compare_options");
    expect(result.nextAction).toEqual({
      label: "Confronta opzioni",
      href: "/settori",
      sectionId: "career_comparison",
    });
  });

  it("derives choose_path when readiness is high and the user is still indeciso", () => {
    const result = deriveDashboardPhase({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 4,
      readinessBand: "high",
    });

    expect(result.phase).toBe("choose_path");
    expect(result.nextAction).toEqual({
      label: "Scegli percorso",
      href: "/percorso",
      sectionId: "tools",
    });
  });

  it("derives active_journey for non-indeciso users", () => {
    const result = deriveDashboardPhase({
      ...baseInput,
      journeyType: "dipendente",
      hasSession: true,
      savedSectorsCount: 5,
    });

    expect(result.phase).toBe("active_journey");
    expect(result.nextAction).toEqual({
      label: "Apri prossima routine",
      href: "/dashboard",
      sectionId: "next_routine",
    });
  });

  it("promotes the active indeciso section above stale saved layout positions", () => {
    const layout = getAdaptiveDashboardLayout({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 1,
      layout: [
        { id: "tools", position: 0, visible: true, size: "lg" },
        { id: "personality", position: 1, visible: true, size: "md" },
        { id: "discovery_feed", position: 2, visible: true, size: "lg" },
        { id: "clarity_path", position: 3, visible: true, size: "lg" },
      ],
    });

    expect(layout.map((section) => section.id).slice(0, 3)).toEqual([
      "clarity_path",
      "discovery_feed",
      "tools",
    ]);
  });

  it("forces the mission-critical clarity path and active next section visible above hidden saved layout choices", () => {
    const layout = getAdaptiveDashboardLayout({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 1,
      layout: [
        { id: "tools", position: 0, visible: true, size: "lg" },
        { id: "personality", position: 1, visible: true, size: "md" },
        { id: "discovery_feed", position: 2, visible: false, size: "lg" },
        { id: "clarity_path", position: 3, visible: false, size: "lg" },
      ],
    });

    expect(layout.map((section) => [section.id, section.visible]).slice(0, 3)).toEqual([
      ["clarity_path", true],
      ["discovery_feed", true],
      ["tools", true],
    ]);
  });

  it("promotes the active journey next routine above saved standard layout preferences", () => {
    const layout = getAdaptiveDashboardLayout({
      ...baseInput,
      journeyType: "dipendente",
      hasSession: true,
      layout: [
        { id: "week_timeline", position: 0, visible: true, size: "lg" },
        { id: "kpi_strip", position: 1, visible: true, size: "lg" },
        { id: "next_routine", position: 2, visible: false, size: "lg" },
        { id: "tools", position: 3, visible: true, size: "lg" },
      ],
    });

    expect(layout.map((section) => [section.id, section.visible])).toEqual([
      ["next_routine", true],
      ["week_timeline", true],
      ["kpi_strip", true],
      ["tools", true],
    ]);
  });

  it("marks the active section as primary and future gated sections as gated", () => {
    const presentation = getAdaptiveSectionPresentation({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 1,
    });

    expect(presentation.discovery_feed).toMatchObject({ priority: "primary", gated: false });
    expect(presentation.career_comparison).toMatchObject({ priority: "supporting", gated: true });
  });
});
