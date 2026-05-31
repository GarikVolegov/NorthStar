import type { WidgetLayout } from "@/hooks/useDashboardLayout";

export type DashboardJourneyLayout = "indeciso" | "standard";

export interface DashboardSectionDefinition {
  id: string;
  label: string;
  description: string;
  size: WidgetLayout["size"];
}

const INDECISO_SECTIONS: DashboardSectionDefinition[] = [
  { id: "clarity_path", label: "Mappa della chiarezza", description: "Stato della scelta e prossimi passi.", size: "lg" },
  { id: "next_routine", label: "Prossima routine", description: "La prossima automazione personale configurabile con Wendy.", size: "md" },
  { id: "discovery_feed", label: "Settori consigliati", description: "Settori suggeriti e salvabili per esplorare nuove direzioni.", size: "lg" },
  { id: "personality", label: "Profilo personale", description: "Profilo, segnali e indicatori personali.", size: "md" },
  { id: "career_comparison", label: "Confronto carriere", description: "Comparazione fra due percorsi consigliati.", size: "lg" },
  { id: "wendy_prompts", label: "Prompt Wendy", description: "Azioni rapide per farti guidare da Wendy.", size: "lg" },
  { id: "tools", label: "Strumenti del percorso", description: "Strumenti disponibili per il tuo percorso.", size: "lg" },
  { id: "analysis", label: "Analisi personalizzata", description: "Professioni e modalita di lavoro suggerite dall'AI.", size: "lg" },
];

const STANDARD_SECTIONS: DashboardSectionDefinition[] = [
  { id: "kpi_strip", label: "Indicatori principali", description: "Progressi, settore, obiettivi e stato del profilo.", size: "lg" },
  { id: "next_routine", label: "Prossima routine", description: "La prossima automazione personale configurabile con Wendy.", size: "md" },
  { id: "week_timeline", label: "Timeline settimanale", description: "Eventi, obiettivi e prossima azione.", size: "lg" },
  { id: "diary_objectives", label: "Diario e obiettivi", description: "Diario personale e avanzamento degli obiettivi.", size: "lg" },
  { id: "personality", label: "Profilo personale", description: "Profilo, segnali e indicatori personali.", size: "md" },
  { id: "wendy_insights", label: "Insight da Wendy", description: "Insight proattivi recenti da Wendy.", size: "md" },
  { id: "tools", label: "Strumenti del percorso", description: "Strumenti disponibili per il tuo percorso.", size: "lg" },
  { id: "analysis", label: "Analisi personalizzata", description: "Professioni e modalita di lavoro suggerite dall'AI.", size: "lg" },
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
