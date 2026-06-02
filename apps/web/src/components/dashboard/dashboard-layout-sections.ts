import type { WidgetLayout } from "@/hooks/useDashboardLayout";

export type DashboardJourneyLayout = "indeciso" | "standard";

export interface DashboardSectionDefinition {
  id: string;
  label: string;
  description: string;
  labelKey: string;
  descriptionKey: string;
  size: WidgetLayout["size"];
}

function defineDashboardSection(
  id: string,
  label: string,
  description: string,
  size: WidgetLayout["size"],
): DashboardSectionDefinition {
  return {
    id,
    label,
    description,
    labelKey: `dashboard.layout.sections.${id}.label`,
    descriptionKey: `dashboard.layout.sections.${id}.description`,
    size,
  };
}

const INDECISO_SECTIONS: DashboardSectionDefinition[] = [
  defineDashboardSection("clarity_path", "Mappa della chiarezza", "Stato della scelta e prossimi passi.", "lg"),
  defineDashboardSection("next_routine", "Prossima routine", "La prossima automazione personale configurabile con Wendy.", "md"),
  defineDashboardSection("discovery_feed", "Scelta settore e ruolo", "Settori consigliati con accesso ai ruoli target e ai lavori reali.", "lg"),
  defineDashboardSection("personality", "Profilo personale", "Profilo, segnali e indicatori personali.", "md"),
  defineDashboardSection("career_comparison", "Confronto carriere", "Comparazione fra due percorsi consigliati.", "lg"),
  defineDashboardSection("wendy_prompts", "Prompt Wendy", "Azioni rapide per farti guidare da Wendy.", "lg"),
  defineDashboardSection("tools", "Strumenti del percorso", "Strumenti disponibili per il tuo percorso.", "lg"),
  defineDashboardSection("analysis", "Ruoli e competenze target", "Professioni, competenze e modalita di lavoro da collegare alla ricerca.", "lg"),
];

const STANDARD_SECTIONS: DashboardSectionDefinition[] = [
  defineDashboardSection("kpi_strip", "Indicatori principali", "Progressi, settore, obiettivi e stato del profilo.", "lg"),
  defineDashboardSection("next_routine", "Prossima routine", "La prossima automazione personale configurabile con Wendy.", "md"),
  defineDashboardSection("week_timeline", "Timeline settimanale", "Eventi, obiettivi e prossima azione.", "lg"),
  defineDashboardSection("diary_objectives", "Diario e obiettivi", "Diario personale e avanzamento degli obiettivi.", "lg"),
  defineDashboardSection("personality", "Profilo personale", "Profilo, segnali e indicatori personali.", "md"),
  defineDashboardSection("wendy_insights", "Insight da Wendy", "Insight proattivi recenti da Wendy.", "md"),
  defineDashboardSection("tools", "Strumenti del percorso", "Strumenti disponibili per il tuo percorso.", "lg"),
  defineDashboardSection("analysis", "Ruoli e competenze target", "Professioni, competenze e modalita di lavoro da collegare alla ricerca.", "lg"),
];

export function getDashboardJourneyLayout(journeyType?: string | null): DashboardJourneyLayout {
  return journeyType === "indeciso" ? "indeciso" : "standard";
}

export function getDashboardSectionCatalog(journeyType?: string | null): DashboardSectionDefinition[] {
  return getDashboardJourneyLayout(journeyType) === "indeciso" ? INDECISO_SECTIONS : STANDARD_SECTIONS;
}

export function getDefaultDashboardSectionLayout(journeyType?: string | null): WidgetLayout[] {
  return getDashboardSectionCatalog(journeyType).map((section, position) => ({
    id: section.id,
    position,
    visible: true,
    size: section.size,
  }));
}

export function resolveDashboardSectionLayout(
  layout: WidgetLayout[] | undefined,
  journeyType?: string | null,
): WidgetLayout[] {
  const defaults = getDefaultDashboardSectionLayout(journeyType);
  if (!Array.isArray(layout) || layout.length === 0) return defaults;

  const catalogById = new Map(getDashboardSectionCatalog(journeyType).map((section) => [section.id, section]));
  const seen = new Set<string>();
  const resolved: WidgetLayout[] = [];

  for (const item of layout) {
    const section = catalogById.get(item.id);
    if (!section || seen.has(item.id)) return defaults;
    seen.add(item.id);
    resolved.push({
      id: item.id,
      position: Number.isFinite(item.position) ? Math.max(0, Math.floor(item.position)) : resolved.length,
      visible: item.visible,
      size: section.size,
    });
  }

  for (const item of defaults) {
    if (!seen.has(item.id)) resolved.push({ ...item, visible: false, position: resolved.length });
  }

  return resolved.sort((a, b) => a.position - b.position).map((item, position) => ({ ...item, position }));
}

export function getDashboardSectionLabel(id: string, journeyType?: string | null): string {
  return getDashboardSectionCatalog(journeyType).find((section) => section.id === id)?.label ?? id;
}
