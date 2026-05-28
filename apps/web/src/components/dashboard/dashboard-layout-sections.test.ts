import { describe, expect, it } from "vitest";

import {
  getDashboardSectionCatalog,
  getDefaultDashboardSectionLayout,
  resolveDashboardSectionLayout,
} from "./dashboard-layout-sections";

describe("dashboard layout sections", () => {
  it("exposes real dashboard sections and the single new routine card", () => {
    const labels = getDashboardSectionCatalog("dipendente").map((section) => section.label);

    expect(labels).toEqual([
      "Indicatori principali",
      "Prossima routine",
      "Timeline settimanale",
      "Diario e obiettivi",
      "Profilo personale",
      "Insight da Wendy",
      "Strumenti del percorso",
      "Analisi personalizzata",
    ]);
    expect(labels).not.toContain("Monitor offerte lavoro");
    expect(labels).not.toContain("Streak mindset");
    expect(labels).not.toContain("Obiettivi in corso");
  });

  it("falls back to the journey default when an old ghost-widget layout is loaded", () => {
    const resolved = resolveDashboardSectionLayout(
      [
        { id: "progress_objectives", position: 0, visible: true, size: "lg" },
        { id: "job_feed", position: 1, visible: true, size: "md" },
        { id: "insights", position: 2, visible: true, size: "md" },
      ],
      "dipendente",
    );

    expect(resolved).toEqual(getDefaultDashboardSectionLayout("dipendente"));
  });

  it("uses the indeciso catalog for indeciso users", () => {
    const ids = getDefaultDashboardSectionLayout("indeciso").map((section) => section.id);

    expect(ids).toEqual([
      "clarity_path",
      "next_routine",
      "discovery_feed",
      "personality",
      "career_comparison",
      "wendy_prompts",
      "tools",
      "analysis",
    ]);
  });
});
