import {
  DECISION_LABELS,
  DEFAULT_CANVAS,
  EXPERIMENT_TEMPLATES,
} from "./ideaValidatorConfig";
import type {
  CanvasKey,
  CompetitorEntry,
  DecisionSuggestion,
  GuidedExperiment,
  GuidedStep,
  IdeaStatus,
  IdeaValidationData,
  TimelineEvent,
  TimelineEventType,
} from "./ideaValidatorTypes";

export function normalizeCanvas(
  source?: IdeaValidationData["canvas"] | null,
): Record<CanvasKey, string> {
  return {
    ...DEFAULT_CANVAS,
    ...(source ?? {}),
    customer: source?.customer ?? source?.audience ?? "",
    channels: source?.channels ?? source?.channel ?? "",
    monetization: source?.monetization ?? source?.business ?? "",
    evidence: source?.evidence ?? source?.signals ?? "",
  };
}

export function createCompetitor(overrides: Partial<CompetitorEntry> = {}): CompetitorEntry {
  const now = new Date().toISOString();
  return {
    id:
      overrides.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `competitor-${Date.now()}`),
    name: "Nuovo competitor",
    url: "",
    positioning: "",
    price: "",
    strengths: "",
    weaknesses: "",
    opportunity: "",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createExperimentFromTemplate(
  template = EXPERIMENT_TEMPLATES[0] ?? {
    template: "manual",
    title: "Esperimento",
    objective: "",
    hypothesis: "",
    metric: "",
    expectedResult: "",
  },
  overrides: Partial<GuidedExperiment> = {},
): GuidedExperiment {
  const now = new Date().toISOString();
  return {
    id:
      overrides.id ??
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `experiment-${Date.now()}`),
    template: template.template,
    title: template.title,
    objective: template.objective,
    hypothesis: template.hypothesis,
    metric: template.metric,
    expectedResult: template.expectedResult,
    deadline: "",
    outcome: "",
    status: "planned",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createTimelineEvent(
  type: TimelineEventType,
  title: string,
  description: string,
  metadata?: Record<string, unknown>,
  createdAt = new Date().toISOString(),
): TimelineEvent {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `timeline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    title,
    description,
    createdAt,
    ...(metadata ? { metadata } : {}),
  };
}

export function normalizeTimeline(value?: TimelineEvent[] | null) {
  if (!Array.isArray(value)) return [];
  return [...value]
    .filter((event) => event?.id && event?.type && event?.title && event?.createdAt)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function normalizeDecisionSuggestion(value: unknown): DecisionSuggestion | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Partial<DecisionSuggestion>;
  if (!data.state || !(data.state in DECISION_LABELS) || !data.reason || !data.generatedAt) {
    return null;
  }
  return {
    state: data.state,
    reason: String(data.reason),
    confidence: Number.isFinite(Number(data.confidence)) ? Number(data.confidence) : 0,
    nextActions: Array.isArray(data.nextActions) ? data.nextActions.map(String) : [],
    generatedAt: String(data.generatedAt),
    model: String(data.model ?? ""),
  };
}

export function suggestGuidedStep(data: IdeaValidationData, fallbackStatus?: IdeaStatus): GuidedStep {
  if (data.decisionState || fallbackStatus === "validated" || fallbackStatus === "discarded") {
    return "decide";
  }
  if (Array.isArray(data.experiments) && data.experiments.length > 0) return "test";
  if (
    data.scoreGeneratedAt ||
    Object.keys(data.scores ?? {}).length > 0 ||
    Array.isArray(data.competitors) && data.competitors.length > 0 ||
    Boolean(data.market?.currentAlternative || data.market?.opportunities)
  ) {
    return "sense";
  }
  return "describe";
}

export function normalizeExperiments(data: IdeaValidationData) {
  if (Array.isArray(data.experiments) && data.experiments.length > 0) {
    return data.experiments;
  }
  if (data.experiment?.trim()) {
    return [
      createExperimentFromTemplate(EXPERIMENT_TEMPLATES[0], {
        id: "legacy-experiment",
        template: "legacy",
        title: "Esperimento legacy",
        objective: data.experiment.trim(),
      }),
    ];
  }
  return [];
}

export function formatDate(value?: string) {
  if (!value) return "mai";
  return new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}
