import { useWendy } from "@/contexts/WendyProvider";
import { IdeaCanvasSection, MarketCompetitorsSection } from "@/features/idea-validator/IdeaCanvasMarketSections";
import { IdeaDecisionSection, IdeaSummarySection, IdeaTimelineSection, IdeaWendyActionsSection } from "@/features/idea-validator/IdeaDecisionSections";
import { ExperimentsSection, RadarAndTestSetupSection } from "@/features/idea-validator/IdeaExperimentSections";
import { GuidedStepsPanel, IdeaHeaderPanel, IdeaListPanel } from "@/features/idea-validator/IdeaTopPanels";
import { CANVAS_FIELDS, DECISION_LABELS, DEFAULT_CANVAS, DEFAULT_MARKET, DEFAULT_SCORES, EMPTY_SCORE_TEXT, EXPERIMENT_TEMPLATES, GUIDED_STEPS, SCORE_LABELS, STATUS_LABELS } from "@/features/idea-validator/ideaValidatorConfig";
import type { BusinessIdea, CanvasKey, CompetitorEntry, DecisionState, DecisionSuggestion, ExperimentAction, GuidedExperiment, GuidedStep, IdeaStatus, IdeaValidationData, MarketInsight, RadarState, RadarSuggestion, SaveState, ScoreKey, TimelineEvent, TimelineEventType } from "@/features/idea-validator/ideaValidatorTypes";
import { createCompetitor, createExperimentFromTemplate, createTimelineEvent, normalizeCanvas, normalizeDecisionSuggestion, normalizeExperiments, normalizeTimeline, suggestGuidedStep } from "@/features/idea-validator/ideaValidatorUtils";
import { usePageModule } from "@/hooks/usePageModule";
import { apiFetch } from "@/lib/api-fetch";
import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
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
  const [canvas, setCanvas] = useState(DEFAULT_CANVAS);
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
      events.push(
        createTimelineEvent(
          "idea_created",
          "Idea creata",
          "Questa idea e stata salvata nel laboratorio.",
          { source: "derived" },
          activeIdea.createdAt,
        ),
      );
    }
    if (scoreGeneratedAt) {
      events.push(
        createTimelineEvent(
          "score_updated",
          "Radar valutato",
          scoreModel ? `Wendy ha proposto una valutazione con ${scoreModel}.` : "Wendy ha proposto una valutazione del radar.",
          { source: "derived", model: scoreModel },
          scoreGeneratedAt,
        ),
      );
    }
    experiments.forEach((item) => {
      if (item.createdAt) {
        events.push(
          createTimelineEvent(
            "experiment_created",
            "Esperimento creato",
            item.title || "Esperimento aggiunto all'idea.",
            { source: "derived", experimentId: item.id },
            item.createdAt,
          ),
        );
      }
      if (item.completedAt) {
        events.push(
          createTimelineEvent(
            "experiment_completed",
            "Esperimento completato",
            item.title || "Esperimento segnato come completato.",
            { source: "derived", experimentId: item.id },
            item.completedAt,
          ),
        );
      }
    });
    if ((status === "validated" || status === "discarded") && activeIdea.updatedAt) {
      events.push(
        createTimelineEvent(
          "status_changed",
          status === "validated" ? "Idea validata" : "Idea scartata",
          `Stato attuale: ${STATUS_LABELS[status]}.`,
          { source: "derived", status },
          activeIdea.updatedAt,
        ),
      );
    }
    return events.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
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
    [
      canvas,
      scores,
      scoreReasons,
      scoreSuggestions,
      scoreGeneratedAt,
      scoreModel,
      assumption,
      activeExperimentSummary,
      experiments,
      activeExperimentId,
      market,
      competitors,
      activeCompetitorId,
      lastWendyAdvice,
      timeline,
      decisionState,
      decisionReason,
      decisionUpdatedAt,
      decisionSuggested,
      oneLiner,
    ],
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
    [
      activeIdeaId,
      activeIdea?.updatedAt,
      status,
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
      activeExperimentSummary,
      experiments,
      activeExperimentId,
      activeExperiment,
      market,
      competitors,
      activeCompetitorId,
      activeCompetitor,
      lastWendyAdvice,
      displayTimeline,
      decisionState,
      decisionReason,
      decisionUpdatedAt,
      decisionSuggested,
    ],
  );

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

  const askWendy = (focus: string) => {
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
  };

  const updateCanvas = (key: CanvasKey, value: string) => {
    setCanvas((current) => ({ ...current, [key]: value }));
    markDirty();
    addDebouncedTimelineEvent(
      canvasTimelineTimerRef,
      "canvas_updated",
      "Canvas aggiornato",
      `Hai modificato il blocco ${CANVAS_FIELDS.find((field) => field.key === key)?.title ?? "canvas"}.`,
      { key },
    );
  };

  const requestRadarSuggestion = async () => {
    setRadarState("loading");
    setRadarError("");

    let ideaId = activeIdeaId;
    if (!ideaId) {
      const created = await persistIdea("create");
      ideaId = created?.id ?? null;
    }

    if (!ideaId) {
      setRadarState("error");
      setRadarError("Salva una bozza prima di chiedere la valutazione a Wendy.");
      return;
    }

    try {
      const res = await apiFetch(`${BASE}api/business-ideas/${ideaId}/radar-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ideaName,
          ideaText: oneLiner,
          canvas,
          assumption,
          experiment: activeExperimentSummary,
        }),
      });

      if (!res.ok) {
        throw new Error(await readResponseError(res, "Valutazione Wendy non disponibile"));
      }

      const suggestion = (await res.json()) as RadarSuggestion;
      setProposedScores(suggestion.scores);
      setScoreReasons(suggestion.reasons);
      setScoreSuggestions(suggestion.suggestions);
      setScoreGeneratedAt(suggestion.generatedAt);
      setScoreModel(suggestion.model);
      setRadarState("idle");
      addTimelineEvent(
        "score_updated",
        "Radar valutato da Wendy",
        "Wendy ha proposto score, motivazioni e suggerimenti per il radar.",
        { model: suggestion.model, generatedAt: suggestion.generatedAt },
      );
      markDirty();
    } catch (err) {
      setRadarState("error");
      setRadarError(err instanceof Error ? err.message : "Valutazione Wendy non disponibile");
    }
  };

  const applyProposedScore = (key: ScoreKey) => {
    const proposed = proposedScores[key];
    if (!proposed) return;
    setScores((current) => ({ ...current, [key]: proposed }));
    setProposedScores((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
    addTimelineEvent(
      "score_updated",
      "Score applicato",
      `${SCORE_LABELS[key].label}: applicato ${proposed}/5 dal suggerimento Wendy.`,
      { key, score: proposed },
    );
    markDirty();
  };

  const updateScore = (key: ScoreKey, nextScore: number) => {
    setScores((current) => ({ ...current, [key]: nextScore }));
    addDebouncedTimelineEvent(
      scoreTimelineTimerRef,
      "score_updated",
      "Score aggiornato",
      `${SCORE_LABELS[key].label}: impostato a ${nextScore}/5.`,
      { key, score: nextScore },
    );
    markDirty();
  };

  const updateAssumption = (value: string) => {
    setAssumption(value);
    markDirty();
  };

  const updateLastWendyAdvice = (value: string) => {
    setLastWendyAdvice(value);
    addDebouncedTimelineEvent(
      wendyAdviceTimelineTimerRef,
      "wendy_feedback",
      "Consiglio Wendy aggiornato",
      "Hai aggiornato la sintesi dell'ultimo consiglio Wendy.",
      { field: "lastWendyAdvice" },
    );
    markDirty();
  };

  const applyDecision = (
    nextState: DecisionState,
    reason: string,
    source: "manual" | "wendy",
    suggestion?: DecisionSuggestion,
  ) => {
    const now = new Date().toISOString();
    setDecisionState(nextState);
    setDecisionReason(reason);
    setDecisionUpdatedAt(now);
    if (suggestion) setDecisionSuggested(suggestion);
    addTimelineEvent(
      "decision_changed",
      source === "wendy" ? "Decisione approvata" : "Decisione aggiornata",
      `${DECISION_LABELS[nextState]}${reason ? ` - ${reason}` : ""}`,
      { state: nextState, source },
    );
    markDirty();
  };

  const requestDecisionSuggestion = async () => {
    setDecisionLoading(true);
    setDecisionError("");

    let ideaId = activeIdeaId;
    if (!ideaId) {
      const created = await persistIdea("create");
      ideaId = created?.id ?? null;
    }

    if (!ideaId) {
      setDecisionLoading(false);
      setDecisionError("Salva una bozza prima di chiedere una decisione a Wendy.");
      return;
    }

    try {
      const res = await apiFetch(`${BASE}api/business-ideas/${ideaId}/decision-suggestion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ideaName,
          ideaText: oneLiner,
          data: ideaContext,
        }),
      });

      if (!res.ok) {
        throw new Error(await readResponseError(res, "Suggerimento decisione non disponibile"));
      }

      const suggestion = (await res.json()) as DecisionSuggestion;
      setDecisionSuggested(suggestion);
      addTimelineEvent(
        "wendy_feedback",
        "Decisione consigliata da Wendy",
        `${DECISION_LABELS[suggestion.state]} - ${suggestion.reason}`,
        { state: suggestion.state, confidence: suggestion.confidence, model: suggestion.model },
      );
      markDirty();
    } catch (err) {
      setDecisionError(
        err instanceof Error ? err.message : "Suggerimento decisione non disponibile",
      );
    } finally {
      setDecisionLoading(false);
    }
  };

  const createExperiment = (templateId = selectedTemplate) => {
    const template =
      EXPERIMENT_TEMPLATES.find((item) => item.template === templateId) ?? EXPERIMENT_TEMPLATES[0];
    if (!template) return;
    const next = createExperimentFromTemplate(template);
    setExperiments((current) => [next, ...current]);
    setActiveExperimentId(next.id);
    setSelectedTemplate(template.template);
    addTimelineEvent("experiment_created", "Esperimento creato", next.title, {
      experimentId: next.id,
      template: next.template,
    });
    markDirty();
  };

  const duplicateActiveExperiment = () => {
    if (!activeExperiment) return;
    const next = createExperimentFromTemplate(EXPERIMENT_TEMPLATES[0], {
      ...activeExperiment,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `experiment-${Date.now()}`,
      title: `${activeExperiment.title} - copia`,
      status: "planned",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setExperiments((current) => [next, ...current]);
    setActiveExperimentId(next.id);
    addTimelineEvent("experiment_created", "Esperimento duplicato", next.title, {
      experimentId: next.id,
      sourceExperimentId: activeExperiment.id,
    });
    markDirty();
  };

  const updateActiveExperiment = <K extends keyof GuidedExperiment>(
    key: K,
    value: GuidedExperiment[K],
  ) => {
    if (!activeExperiment) return;
    const now = new Date().toISOString();
    setExperiments((current) =>
      current.map((item) =>
        item.id === activeExperiment.id ? { ...item, [key]: value, updatedAt: now } : item,
      ),
    );
    if (key === "status" && value === "completed" && activeExperiment.status !== "completed") {
      addTimelineEvent("experiment_completed", "Esperimento completato", activeExperiment.title, {
        experimentId: activeExperiment.id,
      });
    }
    markDirty();
  };

  const patchActiveExperiment = (patch: Partial<GuidedExperiment>) => {
    if (!activeExperiment) return;
    const now = new Date().toISOString();
    setExperiments((current) =>
      current.map((item) =>
        item.id === activeExperiment.id ? { ...item, ...patch, updatedAt: now } : item,
      ),
    );
    markDirty();
  };

  const discardActiveExperiment = () => {
    if (!activeExperiment) return;
    updateActiveExperiment("status", "discarded");
  };

  const experimentDueDate = () => {
    if (activeExperiment?.deadline) return activeExperiment.deadline;
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 7);
    return fallback.toISOString().slice(0, 10);
  };

  const experimentDescription = () => {
    if (!activeExperiment) return "";
    return [
      activeExperiment.objective && `Obiettivo: ${activeExperiment.objective}`,
      activeExperiment.hypothesis && `Ipotesi: ${activeExperiment.hypothesis}`,
      activeExperiment.metric && `Misura: ${activeExperiment.metric}`,
      activeExperiment.expectedResult && `Risultato atteso: ${activeExperiment.expectedResult}`,
      ideaName && `Idea: ${ideaName}`,
    ]
      .filter(Boolean)
      .join("\n");
  };

  const createExperimentObjective = async () => {
    if (!activeExperiment || activeExperiment.objectiveId) return;
    setExperimentActionLoading("objective");
    setExperimentActionError("");
    try {
      const res = await apiFetch(`${BASE}api/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: activeExperiment.title || "Esperimento idea",
          category: "business",
          dueDate: experimentDueDate(),
        }),
      });
      if (!res.ok) {
        throw new Error(await readResponseError(res, "Errore nella creazione del task"));
      }
      const objective = (await res.json()) as { id: number };
      patchActiveExperiment({ objectiveId: objective.id });
    } catch (err) {
      setExperimentActionError(err instanceof Error ? err.message : "Errore nella creazione del task");
    } finally {
      setExperimentActionLoading(null);
    }
  };

  const createExperimentCalendarEvent = async (
    type: "calendar" | "reminder",
  ) => {
    if (!activeExperiment) return;
    if (type === "calendar" && activeExperiment.calendarEventId) return;
    if (type === "reminder" && activeExperiment.reminderEventId) return;
    setExperimentActionLoading(type);
    setExperimentActionError("");
    try {
      const start = new Date();
      if (type === "reminder") start.setDate(start.getDate() + 7);
      else if (activeExperiment.deadline) {
        const [year, month, day] = activeExperiment.deadline.split("-").map(Number);
        if (year && month && day) start.setFullYear(year, month - 1, day);
      }
      start.setHours(9, 0, 0, 0);
      const end = new Date(start);
      end.setHours(type === "reminder" ? 9 : 10, type === "reminder" ? 30 : 0, 0, 0);

      const res = await apiFetch(`${BASE}api/calendar/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:
            type === "reminder"
              ? `Promemoria: ${activeExperiment.title || "esperimento idea"}`
              : activeExperiment.title || "Esperimento idea",
          description: experimentDescription(),
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          allDay: false,
          category: "task",
          priority: "medium",
          status: "todo",
          tags: ["idea", "esperimento"],
          linkedContentIds: [],
          isRecurring: false,
        }),
      });
      if (!res.ok) {
        throw new Error(await readResponseError(res, "Errore nella creazione dell'evento"));
      }
      const event = (await res.json()) as { id: number };
      patchActiveExperiment(
        type === "reminder" ? { reminderEventId: event.id } : { calendarEventId: event.id },
      );
    } catch (err) {
      setExperimentActionError(
        err instanceof Error ? err.message : "Errore nella creazione dell'evento",
      );
    } finally {
      setExperimentActionLoading(null);
    }
  };

  const completeActiveExperiment = async () => {
    if (!activeExperiment) return;
    setExperimentActionLoading("complete");
    setExperimentActionError("");
    try {
      if (activeExperiment.objectiveId) {
        const res = await apiFetch(`${BASE}api/objectives/${activeExperiment.objectiveId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
        if (!res.ok && res.status !== 404) {
          throw new Error(await readResponseError(res, "Errore nel completamento del task"));
        }
      }
      patchActiveExperiment({
        status: "completed",
        completedAt: new Date().toISOString(),
      });
      addTimelineEvent("experiment_completed", "Esperimento completato", activeExperiment.title, {
        experimentId: activeExperiment.id,
        objectiveId: activeExperiment.objectiveId,
      });
    } catch (err) {
      setExperimentActionError(
        err instanceof Error ? err.message : "Errore nel completamento dell'esperimento",
      );
    } finally {
      setExperimentActionLoading(null);
    }
  };

  const updateMarket = (key: keyof MarketInsight, value: string) => {
    setMarket((current) => ({ ...current, [key]: value }));
    markDirty();
  };

  const addCompetitor = () => {
    const next = createCompetitor();
    setCompetitors((current) => [next, ...current]);
    setActiveCompetitorId(next.id);
    markDirty();
  };

  const duplicateActiveCompetitor = () => {
    if (!activeCompetitor) return;
    const next = createCompetitor({
      ...activeCompetitor,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `competitor-${Date.now()}`,
      name: `${activeCompetitor.name || "Competitor"} - copia`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setCompetitors((current) => [next, ...current]);
    setActiveCompetitorId(next.id);
    markDirty();
  };

  const updateActiveCompetitor = <K extends keyof CompetitorEntry>(
    key: K,
    value: CompetitorEntry[K],
  ) => {
    if (!activeCompetitor) return;
    const now = new Date().toISOString();
    setCompetitors((current) =>
      current.map((item) =>
        item.id === activeCompetitor.id ? { ...item, [key]: value, updatedAt: now } : item,
      ),
    );
    markDirty();
  };

  const removeActiveCompetitor = () => {
    if (!activeCompetitor) return;
    const remaining = competitors.filter((item) => item.id !== activeCompetitor.id);
    setCompetitors(remaining);
    setActiveCompetitorId(remaining[0]?.id ?? "");
    markDirty();
  };

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
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:pt-12">
      <section className="mb-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <IdeaListPanel
          ideas={ideas}
          activeIdeaId={activeIdeaId}
          loadingIdeas={loadingIdeas}
          saveState={saveState}
          createNewIdea={createNewIdea}
          loadIdeaIntoForm={loadIdeaIntoForm}
        />

        <IdeaHeaderPanel
          error={error}
          saveState={saveState}
          saveLabel={saveLabel}
          activeIdeaId={activeIdeaId}
          archiveConfirm={archiveConfirm}
          ideaName={ideaName}
          oneLiner={oneLiner}
          status={status}
          persistIdea={persistIdea}
          archiveIdea={archiveIdea}
          setIdeaName={setIdeaName}
          setOneLiner={setOneLiner}
          setStatus={setStatus}
          addTimelineEvent={addTimelineEvent}
          markDirty={markDirty}
        >
          <GuidedStepsPanel
            activeStep={activeStep}
            guidedProgress={guidedProgress}
            setActiveStep={setActiveStep}
            askWendy={askWendy}
          />
        </IdeaHeaderPanel>
      </section>

      {activeStep === "decide" && (
        <>
          <IdeaSummarySection
            ideaName={ideaName}
            oneLiner={oneLiner}
            averageScore={averageScore}
            status={status}
            problem={canvas.problem.trim()}
            customer={canvas.customer.trim()}
            experiment={experiment.trim()}
            lastWendyAdvice={lastWendyAdvice.trim()}
          />
          <IdeaTimelineSection
            displayTimeline={displayTimeline}
            visibleTimeline={visibleTimeline}
            showAllTimeline={showAllTimeline}
            setShowAllTimeline={setShowAllTimeline}
          />
          <IdeaDecisionSection
            decisionState={decisionState}
            decisionReason={decisionReason}
            decisionUpdatedAt={decisionUpdatedAt}
            decisionSuggested={decisionSuggested}
            decisionLoading={decisionLoading}
            decisionError={decisionError}
            saveState={saveState}
            requestDecisionSuggestion={requestDecisionSuggestion}
            applyDecision={applyDecision}
            setDecisionState={setDecisionState}
            setDecisionReason={setDecisionReason}
            setDecisionUpdatedAt={setDecisionUpdatedAt}
            markDirty={markDirty}
          />
          <IdeaWendyActionsSection askWendy={askWendy} />
        </>
      )}

      {(activeStep === "describe" || activeStep === "sense") && (
        <IdeaCanvasSection
          visibleCanvasKeys={visibleCanvasKeys}
          canvas={canvas}
          averageScore={averageScore}
          updateCanvas={updateCanvas}
          askWendy={askWendy}
        />
      )}

      {activeStep === "sense" && (
        <MarketCompetitorsSection
          market={market}
          competitors={competitors}
          activeCompetitor={activeCompetitor}
          updateMarket={updateMarket}
          addCompetitor={addCompetitor}
          setActiveCompetitorId={setActiveCompetitorId}
          duplicateActiveCompetitor={duplicateActiveCompetitor}
          removeActiveCompetitor={removeActiveCompetitor}
          updateActiveCompetitor={updateActiveCompetitor}
          askWendy={askWendy}
        />
      )}

      {activeStep === "sense" && (
        <RadarAndTestSetupSection
          scores={scores}
          proposedScores={proposedScores}
          scoreReasons={scoreReasons}
          scoreSuggestions={scoreSuggestions}
          scoreGeneratedAt={scoreGeneratedAt}
          scoreModel={scoreModel}
          radarState={radarState}
          radarError={radarError}
          saveState={saveState}
          assumption={assumption}
          lastWendyAdvice={lastWendyAdvice}
          requestRadarSuggestion={requestRadarSuggestion}
          applyProposedScore={applyProposedScore}
          updateScore={updateScore}
          updateAssumption={updateAssumption}
          updateLastWendyAdvice={updateLastWendyAdvice}
          askWendy={askWendy}
        />
      )}

      {activeStep === "test" && (
        <ExperimentsSection
          experiments={experiments}
          activeExperiment={activeExperiment}
          selectedTemplate={selectedTemplate}
          experimentActionLoading={experimentActionLoading}
          experimentActionError={experimentActionError}
          setSelectedTemplate={setSelectedTemplate}
          setActiveExperimentId={setActiveExperimentId}
          createExperiment={createExperiment}
          duplicateActiveExperiment={duplicateActiveExperiment}
          discardActiveExperiment={discardActiveExperiment}
          createExperimentObjective={createExperimentObjective}
          createExperimentCalendarEvent={createExperimentCalendarEvent}
          completeActiveExperiment={completeActiveExperiment}
          updateActiveExperiment={updateActiveExperiment}
          askWendy={askWendy}
        />
      )}
    </div>
  );
}
