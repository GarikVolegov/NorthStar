import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react";

import type { useWendy } from "@/contexts/WendyProvider";
import { apiFetch } from "@/lib/api-fetch";

import {
  CANVAS_FIELDS,
  DECISION_LABELS,
  SCORE_LABELS,
} from "./ideaValidatorConfig";
import type {
  CanvasKey,
  DecisionState,
  DecisionSuggestion,
  RadarState,
  RadarSuggestion,
  ScoreKey,
  TimelineEventType,
} from "./ideaValidatorTypes";
import { readResponseError } from "../../pages/validatore-idea-api";

const BASE = import.meta.env.BASE_URL || "/";

type WendyApi = ReturnType<typeof useWendy>;

interface ScoringActionOptions {
  wendy: WendyApi;
  ideaContext: Record<string, unknown>;
  activeIdeaId: number | null;
  ideaName: string;
  oneLiner: string;
  canvas: Record<CanvasKey, string>;
  assumption: string;
  activeExperimentSummary: string;
  proposedScores: Partial<Record<ScoreKey, number>>;
  setCanvas: Dispatch<SetStateAction<Record<CanvasKey, string>>>;
  setProposedScores: Dispatch<SetStateAction<Partial<Record<ScoreKey, number>>>>;
  setScores: Dispatch<SetStateAction<Record<ScoreKey, number>>>;
  setScoreReasons: Dispatch<SetStateAction<Partial<Record<ScoreKey, string>>>>;
  setScoreSuggestions: Dispatch<SetStateAction<Partial<Record<ScoreKey, string>>>>;
  setScoreGeneratedAt: Dispatch<SetStateAction<string>>;
  setScoreModel: Dispatch<SetStateAction<string>>;
  setRadarState: Dispatch<SetStateAction<RadarState>>;
  setRadarError: Dispatch<SetStateAction<string>>;
  setAssumption: Dispatch<SetStateAction<string>>;
  setLastWendyAdvice: Dispatch<SetStateAction<string>>;
  setDecisionState: Dispatch<SetStateAction<DecisionState | "">>;
  setDecisionReason: Dispatch<SetStateAction<string>>;
  setDecisionUpdatedAt: Dispatch<SetStateAction<string>>;
  setDecisionSuggested: Dispatch<SetStateAction<DecisionSuggestion | null>>;
  setDecisionLoading: Dispatch<SetStateAction<boolean>>;
  setDecisionError: Dispatch<SetStateAction<string>>;
  persistIdea: (mode?: "create" | "update") => Promise<{ id: number } | null>;
  markDirty: () => void;
  addTimelineEvent: (
    type: TimelineEventType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) => void;
  addDebouncedTimelineEvent: (
    timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
    type: TimelineEventType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
    delay?: number,
  ) => void;
  canvasTimelineTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  scoreTimelineTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  wendyAdviceTimelineTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
}

export function useIdeaValidatorScoringActions(options: ScoringActionOptions) {
  const {
    wendy,
    ideaContext,
    activeIdeaId,
    ideaName,
    oneLiner,
    canvas,
    assumption,
    activeExperimentSummary,
    proposedScores,
    setCanvas,
    setProposedScores,
    setScores,
    setScoreReasons,
    setScoreSuggestions,
    setScoreGeneratedAt,
    setScoreModel,
    setRadarState,
    setRadarError,
    setAssumption,
    setLastWendyAdvice,
    setDecisionState,
    setDecisionReason,
    setDecisionUpdatedAt,
    setDecisionSuggested,
    setDecisionLoading,
    setDecisionError,
    persistIdea,
    markDirty,
    addTimelineEvent,
    addDebouncedTimelineEvent,
    canvasTimelineTimerRef,
    scoreTimelineTimerRef,
    wendyAdviceTimelineTimerRef,
  } = options;

  const askWendy = useCallback(
    (focus: string) => {
      wendy.setPageContext({
        page: "validatore-idea",
        title: "Laboratorio Idee",
        data: { ...ideaContext, focus },
      });
      wendy.ask(focus);
      addTimelineEvent("wendy_feedback", "Feedback Wendy richiesto", focus, {
        ideaId: activeIdeaId,
        focus,
      });
    },
    [activeIdeaId, addTimelineEvent, ideaContext, wendy],
  );

  const updateCanvas = useCallback(
    (key: CanvasKey, value: string) => {
      setCanvas((current) => ({ ...current, [key]: value }));
      markDirty();
      addDebouncedTimelineEvent(
        canvasTimelineTimerRef,
        "canvas_updated",
        "Canvas aggiornato",
        `Hai modificato il blocco ${
          CANVAS_FIELDS.find((field) => field.key === key)?.title ?? "canvas"
        }.`,
        { key },
      );
    },
    [addDebouncedTimelineEvent, canvasTimelineTimerRef, markDirty, setCanvas],
  );

  const requestRadarSuggestion = useCallback(async () => {
    setRadarState("loading");
    setRadarError("");
    let ideaId = activeIdeaId;
    if (!ideaId) ideaId = (await persistIdea("create"))?.id ?? null;
    if (!ideaId) {
      setRadarState("error");
      setRadarError("Salva una bozza prima di chiedere la valutazione a Wendy.");
      return;
    }
    try {
      const res = await apiFetch(`${BASE}api/business-ideas/${ideaId}/radar-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: ideaName, ideaText: oneLiner, canvas, assumption, experiment: activeExperimentSummary }),
      });
      if (!res.ok) throw new Error(await readResponseError(res, "Valutazione Wendy non disponibile"));
      const suggestion = (await res.json()) as RadarSuggestion;
      setProposedScores(suggestion.scores);
      setScoreReasons(suggestion.reasons);
      setScoreSuggestions(suggestion.suggestions);
      setScoreGeneratedAt(suggestion.generatedAt);
      setScoreModel(suggestion.model);
      setRadarState("idle");
      addTimelineEvent("score_updated", "Radar valutato da Wendy", "Wendy ha proposto score, motivazioni e suggerimenti per il radar.", {
        model: suggestion.model,
        generatedAt: suggestion.generatedAt,
      });
      markDirty();
    } catch (err) {
      setRadarState("error");
      setRadarError(err instanceof Error ? err.message : "Valutazione Wendy non disponibile");
    }
  }, [
    activeExperimentSummary,
    activeIdeaId,
    addTimelineEvent,
    assumption,
    canvas,
    ideaName,
    markDirty,
    oneLiner,
    persistIdea,
    setProposedScores,
    setRadarError,
    setRadarState,
    setScoreGeneratedAt,
    setScoreModel,
    setScoreReasons,
    setScoreSuggestions,
  ]);

  const applyProposedScore = useCallback(
    (key: ScoreKey) => {
      const proposed = proposedScores[key];
      if (!proposed) return;
      setScores((current) => ({ ...current, [key]: proposed }));
      setProposedScores((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      addTimelineEvent("score_updated", "Score applicato", `${SCORE_LABELS[key].label}: applicato ${proposed}/5 dal suggerimento Wendy.`, { key, score: proposed });
      markDirty();
    },
    [addTimelineEvent, markDirty, proposedScores, setProposedScores, setScores],
  );

  const updateScore = useCallback(
    (key: ScoreKey, nextScore: number) => {
      setScores((current) => ({ ...current, [key]: nextScore }));
      addDebouncedTimelineEvent(scoreTimelineTimerRef, "score_updated", "Score aggiornato", `${SCORE_LABELS[key].label}: impostato a ${nextScore}/5.`, { key, score: nextScore });
      markDirty();
    },
    [addDebouncedTimelineEvent, markDirty, scoreTimelineTimerRef, setScores],
  );

  const updateAssumption = useCallback(
    (value: string) => {
      setAssumption(value);
      markDirty();
    },
    [markDirty, setAssumption],
  );

  const updateLastWendyAdvice = useCallback(
    (value: string) => {
      setLastWendyAdvice(value);
      addDebouncedTimelineEvent(wendyAdviceTimelineTimerRef, "wendy_feedback", "Consiglio Wendy aggiornato", "Hai aggiornato la sintesi dell'ultimo consiglio Wendy.", { field: "lastWendyAdvice" });
      markDirty();
    },
    [addDebouncedTimelineEvent, markDirty, setLastWendyAdvice, wendyAdviceTimelineTimerRef],
  );

  const applyDecision = useCallback(
    (nextState: DecisionState, reason: string, source: "manual" | "wendy", suggestion?: DecisionSuggestion) => {
      const now = new Date().toISOString();
      setDecisionState(nextState);
      setDecisionReason(reason);
      setDecisionUpdatedAt(now);
      if (suggestion) setDecisionSuggested(suggestion);
      addTimelineEvent("decision_changed", source === "wendy" ? "Decisione approvata" : "Decisione aggiornata", `${DECISION_LABELS[nextState]}${reason ? ` - ${reason}` : ""}`, { state: nextState, source });
      markDirty();
    },
    [addTimelineEvent, markDirty, setDecisionReason, setDecisionState, setDecisionSuggested, setDecisionUpdatedAt],
  );

  const requestDecisionSuggestion = useCallback(async () => {
    setDecisionLoading(true);
    setDecisionError("");
    let ideaId = activeIdeaId;
    if (!ideaId) ideaId = (await persistIdea("create"))?.id ?? null;
    if (!ideaId) {
      setDecisionLoading(false);
      setDecisionError("Salva una bozza prima di chiedere una decisione a Wendy.");
      return;
    }
    try {
      const res = await apiFetch(`${BASE}api/business-ideas/${ideaId}/decision-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: ideaName, ideaText: oneLiner, data: ideaContext }),
      });
      if (!res.ok) throw new Error(await readResponseError(res, "Suggerimento decisione non disponibile"));
      const suggestion = (await res.json()) as DecisionSuggestion;
      setDecisionSuggested(suggestion);
      addTimelineEvent("wendy_feedback", "Decisione consigliata da Wendy", `${DECISION_LABELS[suggestion.state]} - ${suggestion.reason}`, {
        state: suggestion.state,
        confidence: suggestion.confidence,
        model: suggestion.model,
      });
      markDirty();
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : "Suggerimento decisione non disponibile");
    } finally {
      setDecisionLoading(false);
    }
  }, [
    activeIdeaId,
    addTimelineEvent,
    ideaContext,
    ideaName,
    markDirty,
    oneLiner,
    persistIdea,
    setDecisionError,
    setDecisionLoading,
    setDecisionSuggested,
  ]);

  return {
    askWendy,
    updateCanvas,
    requestRadarSuggestion,
    applyProposedScore,
    updateScore,
    updateAssumption,
    updateLastWendyAdvice,
    applyDecision,
    requestDecisionSuggestion,
  };
}
