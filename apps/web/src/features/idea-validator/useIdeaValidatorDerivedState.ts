import { useMemo } from "react";

import { GUIDED_STEPS, STATUS_LABELS } from "./ideaValidatorConfig";
import type {
  BusinessIdea,
  CanvasKey,
  CompetitorEntry,
  DecisionState,
  DecisionSuggestion,
  GuidedExperiment,
  GuidedStep,
  IdeaStatus,
  IdeaValidationData,
  MarketInsight,
  ScoreKey,
  TimelineEvent,
} from "./ideaValidatorTypes";
import { createTimelineEvent } from "./ideaValidatorUtils";

interface DerivedStateOptions {
  ideas: BusinessIdea[];
  activeIdeaId: number | null;
  activeStep: GuidedStep;
  ideaName: string;
  oneLiner: string;
  canvas: Record<CanvasKey, string>;
  scores: Record<ScoreKey, number>;
  scoreReasons: Partial<Record<ScoreKey, string>>;
  scoreSuggestions: Partial<Record<ScoreKey, string>>;
  scoreGeneratedAt: string;
  scoreModel: string;
  assumption: string;
  experiment: string;
  experiments: GuidedExperiment[];
  activeExperimentId: string;
  market: MarketInsight;
  competitors: CompetitorEntry[];
  activeCompetitorId: string;
  lastWendyAdvice: string;
  timeline: TimelineEvent[];
  showAllTimeline: boolean;
  decisionState: DecisionState | "";
  decisionReason: string;
  decisionUpdatedAt: string;
  decisionSuggested: DecisionSuggestion | null;
  status: IdeaStatus;
}

export function useIdeaValidatorDerivedState(options: DerivedStateOptions) {
  const {
    ideas,
    activeIdeaId,
    activeStep,
    ideaName,
    oneLiner,
    canvas,
    scores,
    scoreReasons,
    scoreSuggestions,
    scoreGeneratedAt,
    scoreModel,
    assumption,
    experiment,
    experiments,
    activeExperimentId,
    market,
    competitors,
    activeCompetitorId,
    lastWendyAdvice,
    timeline,
    showAllTimeline,
    decisionState,
    decisionReason,
    decisionUpdatedAt,
    decisionSuggested,
    status,
  } = options;

  const activeIdea = ideas.find((idea) => idea.id === activeIdeaId) ?? null;
  const activeExperiment =
    experiments.find((item) => item.id === activeExperimentId) ?? experiments[0] ?? null;
  const activeCompetitor =
    competitors.find((item) => item.id === activeCompetitorId) ?? competitors[0] ?? null;
  const activeExperimentSummary = activeExperiment
    ? [
        activeExperiment.title,
        activeExperiment.objective,
        activeExperiment.hypothesis,
        activeExperiment.metric,
      ]
        .filter(Boolean)
        .join(" - ")
    : experiment;
  const visibleCanvasKeys: CanvasKey[] =
    activeStep === "describe"
      ? ["problem", "customer", "solution"]
      : activeStep === "sense"
        ? ["differentiation", "channels", "monetization", "evidence", "risks"]
        : [];
  const guidedProgress = Math.round(
    ([
      Boolean(oneLiner.trim() && canvas.problem.trim() && canvas.customer.trim() && canvas.solution.trim()),
      Boolean(scoreGeneratedAt || canvas.evidence.trim() || canvas.risks.trim() || competitors.length > 0),
      experiments.length > 0,
      Boolean(decisionState),
    ].filter(Boolean).length /
      GUIDED_STEPS.length) *
      100,
  );

  const derivedTimeline = useMemo(() => {
    if (!activeIdea || timeline.length > 0) return [];
    const events: TimelineEvent[] = [];
    if (activeIdea.createdAt) {
      events.push(createTimelineEvent("idea_created", "Idea creata", "Questa idea e stata salvata nel laboratorio.", { source: "derived" }, activeIdea.createdAt));
    }
    if (scoreGeneratedAt) {
      events.push(createTimelineEvent("score_updated", "Radar valutato", scoreModel ? `Wendy ha proposto una valutazione con ${scoreModel}.` : "Wendy ha proposto una valutazione del radar.", { source: "derived", model: scoreModel }, scoreGeneratedAt));
    }
    experiments.forEach((item) => {
      if (item.createdAt) events.push(createTimelineEvent("experiment_created", "Esperimento creato", item.title || "Esperimento aggiunto all'idea.", { source: "derived", experimentId: item.id }, item.createdAt));
      if (item.completedAt) events.push(createTimelineEvent("experiment_completed", "Esperimento completato", item.title || "Esperimento segnato come completato.", { source: "derived", experimentId: item.id }, item.completedAt));
    });
    if ((status === "validated" || status === "discarded") && activeIdea.updatedAt) {
      events.push(createTimelineEvent("status_changed", status === "validated" ? "Idea validata" : "Idea scartata", `Stato attuale: ${STATUS_LABELS[status]}.`, { source: "derived", status }, activeIdea.updatedAt));
    }
    return events.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [activeIdea, timeline.length, scoreGeneratedAt, scoreModel, experiments, status]);

  const displayTimeline = timeline.length > 0 ? timeline : derivedTimeline;
  const visibleTimeline = showAllTimeline ? displayTimeline : displayTimeline.slice(0, 8);
  const averageScore = useMemo(() => {
    const values = Object.values(scores);
    return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 20);
  }, [scores]);

  const validationData = useMemo<IdeaValidationData>(
    () => ({
      canvas,
      scores,
      scoreReasons,
      scoreSuggestions,
      scoreGeneratedAt,
      scoreModel,
      assumption,
      experiment: activeExperimentSummary,
      experiments,
      activeExperimentId,
      market,
      competitors,
      activeCompetitorId,
      lastWendyAdvice,
      timeline,
      decisionState: decisionState || undefined,
      decisionReason,
      decisionUpdatedAt,
      decisionSuggested: decisionSuggested ?? undefined,
      oneLiner,
      uiVersion: "idea-lab-v1",
    }),
    [canvas, scores, scoreReasons, scoreSuggestions, scoreGeneratedAt, scoreModel, assumption, activeExperimentSummary, experiments, activeExperimentId, market, competitors, activeCompetitorId, lastWendyAdvice, timeline, decisionState, decisionReason, decisionUpdatedAt, decisionSuggested, oneLiner],
  );

  const ideaContext = useMemo(
    () => ({
      ideaId: activeIdeaId,
      status,
      updatedAt: activeIdea?.updatedAt,
      ideaName,
      oneLiner,
      canvas,
      scores,
      scoreReasons,
      scoreSuggestions,
      scoreGeneratedAt,
      scoreModel,
      averageScore,
      assumption,
      experiment: activeExperimentSummary,
      experiments,
      activeExperimentId,
      activeExperiment,
      market,
      competitors,
      activeCompetitorId,
      activeCompetitor,
      lastWendyAdvice,
      timeline: displayTimeline,
      decisionState,
      decisionReason,
      decisionUpdatedAt,
      decisionSuggested,
    }),
    [activeIdeaId, activeIdea?.updatedAt, status, ideaName, oneLiner, canvas, scores, scoreReasons, scoreSuggestions, scoreGeneratedAt, scoreModel, averageScore, assumption, activeExperimentSummary, experiments, activeExperimentId, activeExperiment, market, competitors, activeCompetitorId, activeCompetitor, lastWendyAdvice, displayTimeline, decisionState, decisionReason, decisionUpdatedAt, decisionSuggested],
  );

  return {
    activeIdea,
    activeExperiment,
    activeCompetitor,
    activeExperimentSummary,
    visibleCanvasKeys,
    guidedProgress,
    displayTimeline,
    visibleTimeline,
    averageScore,
    validationData,
    ideaContext,
  };
}
