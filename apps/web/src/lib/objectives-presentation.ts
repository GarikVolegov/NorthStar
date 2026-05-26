import type { DashboardObjective } from "@/hooks/useDashboardData";

export type ObjectiveImportance = "Critica" | "Alta" | "Media" | "Bassa" | "Completata";

export type ObjectiveMacroArea = {
  key: string;
  label: string;
  description: string;
};

export const OBJECTIVE_HORIZONS = [
  { key: "weekly", label: "Settimanale" },
  { key: "monthly", label: "Mensile" },
  { key: "quarterly", label: "Trimestrale" },
  { key: "yearly", label: "Annuale" },
] as const;

const PROFESSIONAL_MACRO_AREA: ObjectiveMacroArea = {
    key: "professional",
    label: "Crescita professionale",
    description: "Competenze, carriera, ricerca e preparazione.",
};
const BUSINESS_MACRO_AREA: ObjectiveMacroArea = {
    key: "business",
    label: "Business e mercato",
    description: "Mercati, analisi, validazione strategica e crescita business.",
};
const DIRECTION_MACRO_AREA: ObjectiveMacroArea = {
    key: "direction",
    label: "Direzione personale",
    description: "Scoperta, esplorazione e decisioni di percorso.",
};
const ORGANIZATION_MACRO_AREA: ObjectiveMacroArea = {
    key: "organization",
    label: "Persone e organizzazione",
    description: "Selezione, reclutamento e sviluppo dei team.",
};
const PERSONAL_MACRO_AREA: ObjectiveMacroArea = {
    key: "personal",
    label: "Obiettivi personali",
    description: "Traguardi trasversali e iniziative non ancora classificate.",
};

export function isStrategicObjective(objective: DashboardObjective): boolean {
  return objective.category !== "idea_validation";
}

export function getObjectiveMacroArea(category: string | null | undefined): ObjectiveMacroArea {
  const normalized = (category ?? "").toLowerCase().trim();

  if (["carriera", "preparazione", "ricerca", "skill"].includes(normalized)) {
    return PROFESSIONAL_MACRO_AREA;
  }
  if (["business", "mercato", "analisi"].includes(normalized)) {
    return BUSINESS_MACRO_AREA;
  }
  if (["scoperta", "esplorazione", "decisione"].includes(normalized)) {
    return DIRECTION_MACRO_AREA;
  }
  if (["selezione", "reclutamento"].includes(normalized)) {
    return ORGANIZATION_MACRO_AREA;
  }
  return PERSONAL_MACRO_AREA;
}

function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  const now = new Date();
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function getObjectiveImportance(objective: DashboardObjective): ObjectiveImportance {
  if (objective.completed) return "Completata";

  const remaining = daysUntil(objective.dueDate);
  if (remaining !== null && remaining <= 7) return "Critica";
  if ((remaining !== null && remaining <= 30) || objective.progress < 25) return "Alta";
  if (objective.progress >= 70) return "Bassa";
  return "Media";
}

export function sortObjectivesByImportance(objectives: DashboardObjective[]): DashboardObjective[] {
  const order: Record<ObjectiveImportance, number> = {
    Critica: 0,
    Alta: 1,
    Media: 2,
    Bassa: 3,
    Completata: 4,
  };

  return [...objectives].sort((a, b) => order[getObjectiveImportance(a)] - order[getObjectiveImportance(b)]);
}

export function getStrategicProgressPercent(objectives: DashboardObjective[]): number {
  const strategic = objectives.filter(isStrategicObjective);
  if (strategic.length === 0) return 0;

  const total = strategic.reduce((sum, objective) => {
    return sum + (objective.completed ? 100 : Math.max(0, Math.min(100, objective.progress)));
  }, 0);

  return Math.round(total / strategic.length);
}

export function getObjectiveStepText(
  objective: DashboardObjective,
  horizon: (typeof OBJECTIVE_HORIZONS)[number],
): string {
  if (horizon.key === "weekly") {
    return objective.progress > 0
      ? "Completa una singola azione concreta collegata al traguardo."
      : "Definisci il primo passo operativo e rendilo misurabile.";
  }
  if (horizon.key === "monthly") {
    return objective.dueDate
      ? "Raggiungi una milestone prima della scadenza."
      : "Trasforma il traguardo in una milestone mensile verificabile.";
  }
  if (horizon.key === "quarterly") {
    return "Rivedi priorita, risorse e risultati raggiunti.";
  }
  return "Consolida il risultato e collega il prossimo grande obiettivo.";
}

export function groupStrategicObjectivesByMacroArea(objectives: DashboardObjective[]) {
  const groups = new Map<string, { macroArea: ObjectiveMacroArea; objectives: DashboardObjective[] }>();

  for (const objective of objectives.filter(isStrategicObjective)) {
    const macroArea = getObjectiveMacroArea(objective.category);
    const existing = groups.get(macroArea.key);
    if (existing) {
      existing.objectives.push(objective);
    } else {
      groups.set(macroArea.key, { macroArea, objectives: [objective] });
    }
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    objectives: sortObjectivesByImportance(group.objectives),
  }));
}
