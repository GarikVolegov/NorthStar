import { useWendy } from "@/contexts/WendyProvider";
import { IdeaValidatorPageView } from "@/features/idea-validator/IdeaValidatorPageView";
import { DEFAULT_CANVAS, DEFAULT_MARKET, DEFAULT_SCORES, EMPTY_SCORE_TEXT, EXPERIMENT_TEMPLATES } from "@/features/idea-validator/ideaValidatorConfig";
import type { BusinessIdea, CanvasKey, CompetitorEntry, DecisionState, DecisionSuggestion, ExperimentAction, GuidedExperiment, GuidedStep, IdeaStatus, MarketInsight, RadarState, SaveState, ScoreKey, TimelineEvent, TimelineEventType } from "@/features/idea-validator/ideaValidatorTypes";
import { createTimelineEvent, normalizeCanvas, normalizeDecisionSuggestion, normalizeExperiments, normalizeTimeline, suggestGuidedStep } from "@/features/idea-validator/ideaValidatorUtils";
import { useIdeaValidatorDerivedState } from "@/features/idea-validator/useIdeaValidatorDerivedState";
import { useIdeaValidatorExperimentActions } from "@/features/idea-validator/useIdeaValidatorExperimentActions";
import { useIdeaValidatorMarketActions } from "@/features/idea-validator/useIdeaValidatorMarketActions";
import { useIdeaValidatorScoringActions } from "@/features/idea-validator/useIdeaValidatorScoringActions";
import { usePageModule } from "@/hooks/usePageModule";
import { apiFetch } from "@/lib/api-fetch";
import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { readResponseError } from "./validatore-idea-api";

const BASE = import.meta.env.BASE_URL || "/";
export default function ValidatoreIdea() {
  usePageModule({ pageId: "validatore-idea" });
  const wendy = useWendy();
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasTimelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreTimelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wendyAdviceTimelineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ideas, setIdeas] = useState<BusinessIdea[]>([]);
  const [activeIdeaId, setActiveIdeaId] = useState<number | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(true);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const [activeStep, setActiveStep] = useState<GuidedStep>("describe");

  const [ideaName, setIdeaName] = useState("");
  const [oneLiner, setOneLiner] = useState("");
  const [canvas, setCanvas] = useState<Record<CanvasKey, string>>(DEFAULT_CANVAS);
  const [scores, setScores] = useState<Record<ScoreKey, number>>(DEFAULT_SCORES);
  const [scoreReasons, setScoreReasons] =
    useState<Partial<Record<ScoreKey, string>>>(EMPTY_SCORE_TEXT);
  const [scoreSuggestions, setScoreSuggestions] =
    useState<Partial<Record<ScoreKey, string>>>(EMPTY_SCORE_TEXT);
  const [scoreGeneratedAt, setScoreGeneratedAt] = useState("");
  const [scoreModel, setScoreModel] = useState("");
  const [proposedScores, setProposedScores] =
    useState<Partial<Record<ScoreKey, number>>>({});
  const [radarState, setRadarState] = useState<RadarState>("idle");
  const [radarError, setRadarError] = useState("");
  const [status, setStatus] = useState<IdeaStatus>("draft");
  const [assumption, setAssumption] = useState("");
  const [experiment, setExperiment] = useState("");
  const [experiments, setExperiments] = useState<GuidedExperiment[]>([]);
  const [activeExperimentId, setActiveExperimentId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(
    EXPERIMENT_TEMPLATES[0]?.template ?? "",
  );
  const [experimentActionLoading, setExperimentActionLoading] =
    useState<ExperimentAction | null>(null);
  const [experimentActionError, setExperimentActionError] = useState("");
  const [market, setMarket] = useState<MarketInsight>(DEFAULT_MARKET);
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([]);
  const [activeCompetitorId, setActiveCompetitorId] = useState("");
  const [lastWendyAdvice, setLastWendyAdvice] = useState("");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [showAllTimeline, setShowAllTimeline] = useState(false);
  const [decisionState, setDecisionState] = useState<DecisionState | "">("");
  const [decisionReason, setDecisionReason] = useState("");
  const [decisionUpdatedAt, setDecisionUpdatedAt] = useState("");
  const [decisionSuggested, setDecisionSuggested] = useState<DecisionSuggestion | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionError, setDecisionError] = useState("");

  const {
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
  } = useIdeaValidatorDerivedState({
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
  });

  const loadIdeaIntoForm = (idea: BusinessIdea) => {
    const data = idea.validationData ?? {};
    setActiveIdeaId(idea.id);
    setIdeaName(idea.title ?? "");
    setOneLiner(data.oneLiner ?? idea.ideaText ?? "");
    setCanvas(normalizeCanvas(data.canvas));
    setScores({ ...DEFAULT_SCORES, ...(data.scores ?? {}) });
    setScoreReasons({ ...EMPTY_SCORE_TEXT, ...(data.scoreReasons ?? {}) });
    setScoreSuggestions({ ...EMPTY_SCORE_TEXT, ...(data.scoreSuggestions ?? {}) });
    setScoreGeneratedAt(data.scoreGeneratedAt ?? "");
    setScoreModel(data.scoreModel ?? "");
    setProposedScores({});
    setRadarError("");
    setRadarState("idle");
    const nextExperiments = normalizeExperiments(data);
    setExperiments(nextExperiments);
    setActiveExperimentId(data.activeExperimentId ?? nextExperiments[0]?.id ?? "");
    setExperimentActionLoading(null);
    setExperimentActionError("");
    setMarket({ ...DEFAULT_MARKET, ...(data.market ?? {}) });
    const nextCompetitors = Array.isArray(data.competitors) ? data.competitors : [];
    setCompetitors(nextCompetitors);
    setActiveCompetitorId(data.activeCompetitorId ?? nextCompetitors[0]?.id ?? "");
    setAssumption(data.assumption ?? "");
    setExperiment(data.experiment ?? "");
    setLastWendyAdvice(data.lastWendyAdvice ?? "");
    setTimeline(normalizeTimeline(data.timeline));
    setShowAllTimeline(false);
    setDecisionState(data.decisionState ?? "");
    setDecisionReason(data.decisionReason ?? "");
    setDecisionUpdatedAt(data.decisionUpdatedAt ?? "");
    setDecisionSuggested(normalizeDecisionSuggestion(data.decisionSuggested));
    setDecisionError("");
    setDecisionLoading(false);
    setStatus(idea.status ?? "draft");
    setActiveStep(suggestGuidedStep(data, idea.status));
    setDirty(false);
    setArchiveConfirm(false);
    setSaveState("idle");
  };

  const markDirty = () => {
    setDirty(true);
    if (saveState === "saved") setSaveState("idle");
  };

  const addTimelineEvent = (
    type: TimelineEventType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) => {
    const event = createTimelineEvent(type, title, description, metadata);
    setTimeline((current) => {
      const recentDuplicate = current.find(
        (item) =>
          item.type === type &&
          item.title === title &&
          Date.now() - new Date(item.createdAt).getTime() < 120000,
      );
      if (recentDuplicate) return current;
      return [event, ...current].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    });
    markDirty();
  };

  const addDebouncedTimelineEvent = (
    timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>,
    type: TimelineEventType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
    delay = 1200,
  ) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      addTimelineEvent(type, title, description, metadata);
      timerRef.current = null;
    }, delay);
  };

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    setError(null);
    try {
      const res = await apiFetch(`${BASE}api/business-ideas`);
      if (!res.ok) throw new Error("Errore nel caricamento delle idee");
      const json = (await res.json()) as { ideas: BusinessIdea[] };
      const nextIdeas = json.ideas ?? [];
      setIdeas(nextIdeas);
      if (nextIdeas.length > 0) {
        const current = activeIdeaId
          ? nextIdeas.find((idea) => idea.id === activeIdeaId)
          : nextIdeas[0];
        if (current) loadIdeaIntoForm(current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore nel caricamento");
    } finally {
      setLoadingIdeas(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (canvasTimelineTimerRef.current) clearTimeout(canvasTimelineTimerRef.current);
      if (scoreTimelineTimerRef.current) clearTimeout(scoreTimelineTimerRef.current);
      if (wendyAdviceTimelineTimerRef.current) clearTimeout(wendyAdviceTimelineTimerRef.current);
    };
  }, []);

  useEffect(() => {
    wendy.setPageContext({
      page: "validatore-idea",
      title: "Laboratorio Idee",
      data: ideaContext,
    });
  }, [ideaContext, wendy]);

  const persistIdea = async (mode: "create" | "update" = activeIdeaId ? "update" : "create") => {
    setSaveState("saving");
    setError(null);

    const payload = {
      title: ideaName.trim() || "Nuova idea",
      ideaText: oneLiner.trim(),
      status,
      validationScore: averageScore,
      validationData,
    };

    try {
      const res = await apiFetch(
        mode === "update" && activeIdeaId
          ? `${BASE}api/business-ideas/${activeIdeaId}`
          : `${BASE}api/business-ideas`,
        {
          method: mode === "update" && activeIdeaId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!res.ok) {
        throw new Error(await readResponseError(res, "Errore salvataggio"));
      }

      const json = (await res.json()) as { idea: BusinessIdea };
      setIdeas((current) => {
        const exists = current.some((idea) => idea.id === json.idea.id);
        const next = exists
          ? current.map((idea) => (idea.id === json.idea.id ? json.idea : idea))
          : [json.idea, ...current];
        return next.sort(
          (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      });
      setActiveIdeaId(json.idea.id);
      setDirty(false);
      setSaveState("saved");
      setTimeout(() => setSaveState((state) => (state === "saved" ? "idle" : state)), 1800);
      return json.idea;
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Errore salvataggio");
      return null;
    }
  };

  useEffect(() => {
    if (!activeIdeaId || !dirty) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      persistIdea("update");
    }, 900);
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, [activeIdeaId, dirty, ideaName, oneLiner, status, averageScore, validationData]);

  const createNewIdea = async () => {
    setIdeaName("Nuova idea");
    setOneLiner("");
    setCanvas(DEFAULT_CANVAS);
    setScores(DEFAULT_SCORES);
    setScoreReasons(EMPTY_SCORE_TEXT);
    setScoreSuggestions(EMPTY_SCORE_TEXT);
    setScoreGeneratedAt("");
    setScoreModel("");
    setProposedScores({});
    setRadarError("");
    setRadarState("idle");
    setAssumption("");
    setExperiment("");
    setExperiments([]);
    setActiveExperimentId("");
    setSelectedTemplate(EXPERIMENT_TEMPLATES[0]?.template ?? "");
    setExperimentActionLoading(null);
    setExperimentActionError("");
    setMarket(DEFAULT_MARKET);
    setCompetitors([]);
    setActiveCompetitorId("");
    setLastWendyAdvice("");
    setTimeline([]);
    setShowAllTimeline(false);
    setDecisionState("");
    setDecisionReason("");
    setDecisionUpdatedAt("");
    setDecisionSuggested(null);
    setDecisionError("");
    setDecisionLoading(false);
    setStatus("draft");
    setActiveStep("describe");
    setActiveIdeaId(null);
    setDirty(false);
    setArchiveConfirm(false);
    const created = await persistIdea("create");
    if (created) {
      addTimelineEvent("idea_created", "Idea creata", "Hai creato una nuova idea nel laboratorio.", {
        ideaId: created.id,
      });
    }
  };

  const archiveIdea = async () => {
    if (!activeIdeaId) return;
    if (!archiveConfirm) {
      setArchiveConfirm(true);
      return;
    }
    setSaveState("saving");
    setError(null);
    try {
      const res = await apiFetch(`${BASE}api/business-ideas/${activeIdeaId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) throw new Error("Errore archiviazione");
      const remaining = ideas.filter((idea) => idea.id !== activeIdeaId);
      setIdeas(remaining);
      if (remaining[0]) loadIdeaIntoForm(remaining[0]);
      else {
        setActiveIdeaId(null);
        setIdeaName("");
        setOneLiner("");
        setCanvas(DEFAULT_CANVAS);
        setScores(DEFAULT_SCORES);
        setScoreReasons(EMPTY_SCORE_TEXT);
        setScoreSuggestions(EMPTY_SCORE_TEXT);
        setScoreGeneratedAt("");
        setScoreModel("");
        setProposedScores({});
        setRadarError("");
        setRadarState("idle");
        setAssumption("");
        setExperiment("");
        setExperiments([]);
        setActiveExperimentId("");
        setSelectedTemplate(EXPERIMENT_TEMPLATES[0]?.template ?? "");
        setExperimentActionLoading(null);
        setExperimentActionError("");
        setMarket(DEFAULT_MARKET);
        setCompetitors([]);
        setActiveCompetitorId("");
        setLastWendyAdvice("");
        setTimeline([]);
        setShowAllTimeline(false);
        setDecisionState("");
        setDecisionReason("");
        setDecisionUpdatedAt("");
        setDecisionSuggested(null);
        setDecisionError("");
        setDecisionLoading(false);
        setStatus("draft");
        setActiveStep("describe");
        setDirty(false);
      }
      setArchiveConfirm(false);
      setSaveState("idle");
    } catch (err) {
      setSaveState("error");
      setError(err instanceof Error ? err.message : "Errore archiviazione");
    }
  };

  const {
    askWendy,
    updateCanvas,
    requestRadarSuggestion,
    applyProposedScore,
    updateScore,
    updateAssumption,
    updateLastWendyAdvice,
    applyDecision,
    requestDecisionSuggestion,
  } = useIdeaValidatorScoringActions({
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
  });

  const {
    createExperiment,
    duplicateActiveExperiment,
    discardActiveExperiment,
    createExperimentObjective,
    createExperimentCalendarEvent,
    completeActiveExperiment,
    updateActiveExperiment,
  } = useIdeaValidatorExperimentActions({
    activeExperiment,
    selectedTemplate,
    ideaName,
    setExperiments,
    setActiveExperimentId,
    setSelectedTemplate,
    setExperimentActionLoading,
    setExperimentActionError,
    addTimelineEvent,
    markDirty,
  });

  const {
    updateMarket,
    addCompetitor,
    duplicateActiveCompetitor,
    updateActiveCompetitor,
    removeActiveCompetitor,
  } = useIdeaValidatorMarketActions({
    activeCompetitor,
    competitors,
    setMarket,
    setCompetitors,
    setActiveCompetitorId,
    markDirty,
  });

  const saveLabel =
    saveState === "saving"
      ? "Salvataggio..."
      : saveState === "saved"
        ? "Salvato"
        : saveState === "error"
          ? "Errore salvataggio"
          : dirty
            ? "Modifiche non salvate"
            : "Pronto";

  return (
    <IdeaValidatorPageView
      ideas={ideas}
      activeIdeaId={activeIdeaId}
      loadingIdeas={loadingIdeas}
      saveState={saveState}
      saveLabel={saveLabel}
      error={error}
      archiveConfirm={archiveConfirm}
      ideaName={ideaName}
      oneLiner={oneLiner}
      status={status}
      activeStep={activeStep}
      guidedProgress={guidedProgress}
      visibleCanvasKeys={visibleCanvasKeys}
      canvas={canvas}
      averageScore={averageScore}
      displayTimeline={displayTimeline}
      visibleTimeline={visibleTimeline}
      showAllTimeline={showAllTimeline}
      decisionState={decisionState}
      decisionReason={decisionReason}
      decisionUpdatedAt={decisionUpdatedAt}
      decisionSuggested={decisionSuggested}
      decisionLoading={decisionLoading}
      decisionError={decisionError}
      experiment={experiment}
      lastWendyAdvice={lastWendyAdvice}
      market={market}
      competitors={competitors}
      activeCompetitor={activeCompetitor}
      scores={scores}
      proposedScores={proposedScores}
      scoreReasons={scoreReasons}
      scoreSuggestions={scoreSuggestions}
      scoreGeneratedAt={scoreGeneratedAt}
      scoreModel={scoreModel}
      radarState={radarState}
      radarError={radarError}
      assumption={assumption}
      experiments={experiments}
      activeExperiment={activeExperiment}
      selectedTemplate={selectedTemplate}
      experimentActionLoading={experimentActionLoading}
      experimentActionError={experimentActionError}
      createNewIdea={createNewIdea}
      loadIdeaIntoForm={loadIdeaIntoForm}
      persistIdea={persistIdea}
      archiveIdea={archiveIdea}
      setIdeaName={setIdeaName}
      setOneLiner={setOneLiner}
      setStatus={setStatus}
      addTimelineEvent={addTimelineEvent}
      markDirty={markDirty}
      setActiveStep={setActiveStep}
      askWendy={askWendy}
      setShowAllTimeline={setShowAllTimeline}
      requestDecisionSuggestion={requestDecisionSuggestion}
      applyDecision={applyDecision}
      setDecisionState={setDecisionState}
      setDecisionReason={setDecisionReason}
      setDecisionUpdatedAt={setDecisionUpdatedAt}
      updateCanvas={updateCanvas}
      updateMarket={updateMarket}
      addCompetitor={addCompetitor}
      setActiveCompetitorId={setActiveCompetitorId}
      duplicateActiveCompetitor={duplicateActiveCompetitor}
      removeActiveCompetitor={removeActiveCompetitor}
      updateActiveCompetitor={updateActiveCompetitor}
      requestRadarSuggestion={requestRadarSuggestion}
      applyProposedScore={applyProposedScore}
      updateScore={updateScore}
      updateAssumption={updateAssumption}
      updateLastWendyAdvice={updateLastWendyAdvice}
      setSelectedTemplate={setSelectedTemplate}
      setActiveExperimentId={setActiveExperimentId}
      createExperiment={createExperiment}
      duplicateActiveExperiment={duplicateActiveExperiment}
      discardActiveExperiment={discardActiveExperiment}
      createExperimentObjective={createExperimentObjective}
      createExperimentCalendarEvent={createExperimentCalendarEvent}
      completeActiveExperiment={completeActiveExperiment}
      updateActiveExperiment={updateActiveExperiment}
    />
  );
}
