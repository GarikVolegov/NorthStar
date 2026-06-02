import type { WidgetLayout } from "@/hooks/useDashboardLayout";

export type AdaptiveDashboardPhase =
  | "start_test"
  | "explore_sectors"
  | "compare_options"
  | "choose_path"
  | "active_journey";

export type ReadinessBand = "low" | "mid" | "high";

export interface AdaptiveDashboardInput {
  journeyType?: string | null;
  hasSession: boolean;
  savedSectorsCount: number;
  hasDecided: boolean;
  readinessBand?: ReadinessBand | undefined;
  layout: WidgetLayout[];
}

export interface AdaptiveNextAction {
  label: string;
  href: string;
  sectionId: string;
}

export interface AdaptiveDashboardState {
  phase: AdaptiveDashboardPhase;
  nextAction: AdaptiveNextAction;
}

export interface AdaptiveSectionPresentation {
  priority: "primary" | "supporting" | "compact";
  gated: boolean;
}

export type AdaptiveSectionPresentationMap = Record<string, AdaptiveSectionPresentation>;

const INDECISO_PHASE_ORDER: Record<AdaptiveDashboardPhase, string[]> = {
  start_test: ["clarity_path", "wendy_prompts", "tools"],
  explore_sectors: ["clarity_path", "discovery_feed", "tools", "personality"],
  compare_options: ["clarity_path", "career_comparison", "discovery_feed", "wendy_prompts"],
  choose_path: ["clarity_path", "tools", "career_comparison", "wendy_prompts"],
  active_journey: ["kpi_strip", "next_routine", "week_timeline", "diary_objectives", "tools"],
};

const NEXT_ACTION_BY_PHASE: Record<AdaptiveDashboardPhase, AdaptiveNextAction> = {
  start_test: { label: "Inizia il test", href: "/test", sectionId: "clarity_path" },
  explore_sectors: { label: "Scegli settore e ruolo", href: "/settori", sectionId: "discovery_feed" },
  compare_options: { label: "Confronta settori e ruoli", href: "/settori", sectionId: "career_comparison" },
  choose_path: { label: "Scegli percorso", href: "/percorso", sectionId: "tools" },
  active_journey: { label: "Apri prossima routine", href: "/dashboard", sectionId: "next_routine" },
};

const KNOWN_ADAPTIVE_SECTION_IDS = [
  "clarity_path",
  "next_routine",
  "discovery_feed",
  "personality",
  "career_comparison",
  "wendy_prompts",
  "tools",
  "analysis",
  "kpi_strip",
  "week_timeline",
  "diary_objectives",
  "wendy_insights",
];

export function deriveDashboardPhase(input: AdaptiveDashboardInput): AdaptiveDashboardState {
  if (input.journeyType && input.journeyType !== "indeciso") {
    return { phase: "active_journey", nextAction: NEXT_ACTION_BY_PHASE.active_journey };
  }

  if (!input.hasSession) {
    return { phase: "start_test", nextAction: NEXT_ACTION_BY_PHASE.start_test };
  }

  if (input.savedSectorsCount < 3) {
    return { phase: "explore_sectors", nextAction: NEXT_ACTION_BY_PHASE.explore_sectors };
  }

  if (!input.hasDecided && input.readinessBand === "high") {
    return { phase: "choose_path", nextAction: NEXT_ACTION_BY_PHASE.choose_path };
  }

  if (!input.hasDecided) {
    return { phase: "compare_options", nextAction: NEXT_ACTION_BY_PHASE.compare_options };
  }

  return { phase: "active_journey", nextAction: NEXT_ACTION_BY_PHASE.active_journey };
}

export function getAdaptiveDashboardLayout(input: AdaptiveDashboardInput): WidgetLayout[] {
  const sortedLayout = [...input.layout].sort((a, b) => a.position - b.position);
  const sortedVisible = sortedLayout.filter((section) => section.visible);

  const state = deriveDashboardPhase(input);
  const { phase } = state;

  const preferredOrder =
    phase === "active_journey" && input.journeyType !== "indeciso"
      ? [state.nextAction.sectionId]
      : INDECISO_PHASE_ORDER[phase];
  const protectedIds = new Set(
    phase === "active_journey" && input.journeyType !== "indeciso"
      ? [state.nextAction.sectionId]
      : ["clarity_path", state.nextAction.sectionId],
  );
  const byId = new Map(sortedLayout.map((section) => [section.id, section]));
  const promoted = preferredOrder
    .map((id) => byId.get(id))
    .filter((section): section is WidgetLayout => Boolean(section))
    .filter((section) => section.visible || protectedIds.has(section.id))
    .map((section) => protectedIds.has(section.id) ? { ...section, visible: true } : section);
  const promotedIds = new Set(promoted.map((section) => section.id));
  const remaining = sortedVisible.filter((section) => !promotedIds.has(section.id));

  return [...promoted, ...remaining].map((section, position) => ({ ...section, position }));
}

export function getAdaptiveSectionPresentation(input: AdaptiveDashboardInput): AdaptiveSectionPresentationMap {
  const state = deriveDashboardPhase(input);
  const primaryId = state.nextAction.sectionId;
  const result: AdaptiveSectionPresentationMap = {};
  const sectionIds = new Set([...KNOWN_ADAPTIVE_SECTION_IDS, ...input.layout.map((section) => section.id)]);

  for (const sectionId of sectionIds) {
    const gated =
      (sectionId === "career_comparison" && input.savedSectorsCount < 3) ||
      (sectionId === "discovery_feed" && !input.hasSession);

    result[sectionId] = {
      priority: sectionId === primaryId ? "primary" : gated || state.phase === "active_journey" ? "supporting" : "compact",
      gated,
    };
  }

  return result;
}
