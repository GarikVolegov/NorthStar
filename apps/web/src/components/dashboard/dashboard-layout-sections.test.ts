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
      "Ruoli e competenze target",
    ]);
    expect(labels).not.toContain("Monitor offerte lavoro");
    expect(labels).not.toContain("Streak mindset");
    expect(labels).not.toContain("Obiettivi in corso");
  });

  it("exposes stable dynamic translation keys without losing source fallback copy", () => {
    const sections = getDashboardSectionCatalog("dipendente");

    expect(sections[0]).toMatchObject({
      id: "kpi_strip",
      label: "Indicatori principali",
      description: "Progressi, settore, obiettivi e stato del profilo.",
      labelKey: "dashboard.layout.sections.kpi_strip.label",
      descriptionKey: "dashboard.layout.sections.kpi_strip.description",
    });

    expect(sections.every((section) => section.label.trim().length > 0)).toBe(true);
    expect(sections.every((section) => section.description.trim().length > 0)).toBe(true);
    expect(sections.every((section) => section.labelKey === `dashboard.layout.sections.${section.id}.label`)).toBe(true);
    expect(sections.every((section) => section.descriptionKey === `dashboard.layout.sections.${section.id}.description`)).toBe(true);
  });

  it("names the indeciso discovery section as one sector-role-job decision flow", () => {
    const sections = getDashboardSectionCatalog("indeciso");
    const discovery = sections.find((section) => section.id === "discovery_feed");
    const analysis = sections.find((section) => section.id === "analysis");

    expect(discovery).toMatchObject({
      label: "Scelta settore e ruolo",
      description: "Settori consigliati con accesso ai ruoli target e ai lavori reali.",
    });
    expect(analysis).toMatchObject({
      label: "Ruoli e competenze target",
      description: "Professioni, competenze e modalita di lavoro da collegare alla ricerca.",
    });
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
