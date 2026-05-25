import { ExperimentsSection, RadarAndTestSetupSection } from "./IdeaExperimentSections";
import { IdeaCanvasSection, MarketCompetitorsSection } from "./IdeaCanvasMarketSections";
import {
  IdeaDecisionSection,
  IdeaSummarySection,
  IdeaTimelineSection,
  IdeaWendyActionsSection,
} from "./IdeaDecisionSections";
import { GuidedStepsPanel, IdeaHeaderPanel, IdeaListPanel } from "./IdeaTopPanels";
import type {
  BusinessIdea,
  CanvasKey,
  CompetitorEntry,
  DecisionState,
  DecisionSuggestion,
  ExperimentAction,
  GuidedExperiment,
  GuidedStep,
  IdeaStatus,
  MarketInsight,
  RadarState,
  SaveState,
  ScoreKey,
  TimelineEvent,
  TimelineEventType,
} from "./ideaValidatorTypes";
import type { Dispatch, SetStateAction } from "react";

interface IdeaValidatorPageViewProps {
  ideas: BusinessIdea[];
  activeIdeaId: number | null;
  loadingIdeas: boolean;
  saveState: SaveState;
  saveLabel: string;
  error: string | null;
  archiveConfirm: boolean;
  ideaName: string;
  oneLiner: string;
  status: IdeaStatus;
  activeStep: GuidedStep;
  guidedProgress: number;
  visibleCanvasKeys: CanvasKey[];
  canvas: Record<CanvasKey, string>;
  averageScore: number;
  displayTimeline: TimelineEvent[];
  visibleTimeline: TimelineEvent[];
  showAllTimeline: boolean;
  decisionState: DecisionState | "";
  decisionReason: string;
  decisionUpdatedAt: string;
  decisionSuggested: DecisionSuggestion | null;
  decisionLoading: boolean;
  decisionError: string;
  experiment: string;
  lastWendyAdvice: string;
  market: MarketInsight;
  competitors: CompetitorEntry[];
  activeCompetitor: CompetitorEntry | null;
  scores: Record<ScoreKey, number>;
  proposedScores: Partial<Record<ScoreKey, number>>;
  scoreReasons: Partial<Record<ScoreKey, string>>;
  scoreSuggestions: Partial<Record<ScoreKey, string>>;
  scoreGeneratedAt: string;
  scoreModel: string;
  radarState: RadarState;
  radarError: string;
  assumption: string;
  experiments: GuidedExperiment[];
  activeExperiment: GuidedExperiment | null;
  selectedTemplate: string;
  experimentActionLoading: ExperimentAction | null;
  experimentActionError: string;
  createNewIdea: () => Promise<void>;
  loadIdeaIntoForm: (idea: BusinessIdea) => void;
  persistIdea: (mode?: "create" | "update") => Promise<BusinessIdea | null>;
  archiveIdea: () => Promise<void>;
  setIdeaName: (value: string) => void;
  setOneLiner: (value: string) => void;
  setStatus: (value: IdeaStatus) => void;
  addTimelineEvent: (
    type: TimelineEventType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) => void;
  markDirty: () => void;
  setActiveStep: (step: GuidedStep) => void;
  askWendy: (focus: string) => void;
  setShowAllTimeline: Dispatch<SetStateAction<boolean>>;
  requestDecisionSuggestion: () => Promise<void>;
  applyDecision: (
    nextState: DecisionState,
    reason: string,
    source: "manual" | "wendy",
    suggestion?: DecisionSuggestion,
  ) => void;
  setDecisionState: (value: DecisionState | "") => void;
  setDecisionReason: (value: string) => void;
  setDecisionUpdatedAt: (value: string) => void;
  updateCanvas: (key: CanvasKey, value: string) => void;
  updateMarket: (key: keyof MarketInsight, value: string) => void;
  addCompetitor: () => void;
  setActiveCompetitorId: (id: string) => void;
  duplicateActiveCompetitor: () => void;
  removeActiveCompetitor: () => void;
  updateActiveCompetitor: <K extends keyof CompetitorEntry>(
    key: K,
    value: CompetitorEntry[K],
  ) => void;
  requestRadarSuggestion: () => Promise<void>;
  applyProposedScore: (key: ScoreKey) => void;
  updateScore: (key: ScoreKey, nextScore: number) => void;
  updateAssumption: (value: string) => void;
  updateLastWendyAdvice: (value: string) => void;
  setSelectedTemplate: (template: string) => void;
  setActiveExperimentId: (id: string) => void;
  createExperiment: (templateId?: string) => void;
  duplicateActiveExperiment: () => void;
  discardActiveExperiment: () => void;
  createExperimentObjective: () => Promise<void>;
  createExperimentCalendarEvent: (type: "calendar" | "reminder") => Promise<void>;
  completeActiveExperiment: () => Promise<void>;
  updateActiveExperiment: <K extends keyof GuidedExperiment>(
    key: K,
    value: GuidedExperiment[K],
  ) => void;
}

export function IdeaValidatorPageView(props: IdeaValidatorPageViewProps) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-10 md:pt-12">
      <section className="mb-6 grid gap-4 lg:grid-cols-[320px_1fr]">
        <IdeaListPanel ideas={props.ideas} activeIdeaId={props.activeIdeaId} loadingIdeas={props.loadingIdeas} saveState={props.saveState} createNewIdea={props.createNewIdea} loadIdeaIntoForm={props.loadIdeaIntoForm} />
        <IdeaHeaderPanel error={props.error} saveState={props.saveState} saveLabel={props.saveLabel} activeIdeaId={props.activeIdeaId} archiveConfirm={props.archiveConfirm} ideaName={props.ideaName} oneLiner={props.oneLiner} status={props.status} persistIdea={props.persistIdea} archiveIdea={props.archiveIdea} setIdeaName={props.setIdeaName} setOneLiner={props.setOneLiner} setStatus={props.setStatus} addTimelineEvent={props.addTimelineEvent} markDirty={props.markDirty}>
          <GuidedStepsPanel activeStep={props.activeStep} guidedProgress={props.guidedProgress} setActiveStep={props.setActiveStep} askWendy={props.askWendy} />
        </IdeaHeaderPanel>
      </section>

      {props.activeStep === "decide" && (
        <>
          <IdeaSummarySection ideaName={props.ideaName} oneLiner={props.oneLiner} averageScore={props.averageScore} status={props.status} problem={props.canvas.problem.trim()} customer={props.canvas.customer.trim()} experiment={props.experiment.trim()} lastWendyAdvice={props.lastWendyAdvice.trim()} />
          <IdeaTimelineSection displayTimeline={props.displayTimeline} visibleTimeline={props.visibleTimeline} showAllTimeline={props.showAllTimeline} setShowAllTimeline={props.setShowAllTimeline} />
          <IdeaDecisionSection decisionState={props.decisionState} decisionReason={props.decisionReason} decisionUpdatedAt={props.decisionUpdatedAt} decisionSuggested={props.decisionSuggested} decisionLoading={props.decisionLoading} decisionError={props.decisionError} saveState={props.saveState} requestDecisionSuggestion={props.requestDecisionSuggestion} applyDecision={props.applyDecision} setDecisionState={props.setDecisionState} setDecisionReason={props.setDecisionReason} setDecisionUpdatedAt={props.setDecisionUpdatedAt} markDirty={props.markDirty} />
          <IdeaWendyActionsSection askWendy={props.askWendy} />
        </>
      )}

      {(props.activeStep === "describe" || props.activeStep === "sense") && (
        <IdeaCanvasSection visibleCanvasKeys={props.visibleCanvasKeys} canvas={props.canvas} averageScore={props.averageScore} updateCanvas={props.updateCanvas} askWendy={props.askWendy} />
      )}

      {props.activeStep === "sense" && (
        <MarketCompetitorsSection market={props.market} competitors={props.competitors} activeCompetitor={props.activeCompetitor} updateMarket={props.updateMarket} addCompetitor={props.addCompetitor} setActiveCompetitorId={props.setActiveCompetitorId} duplicateActiveCompetitor={props.duplicateActiveCompetitor} removeActiveCompetitor={props.removeActiveCompetitor} updateActiveCompetitor={props.updateActiveCompetitor} askWendy={props.askWendy} />
      )}

      {props.activeStep === "sense" && (
        <RadarAndTestSetupSection scores={props.scores} proposedScores={props.proposedScores} scoreReasons={props.scoreReasons} scoreSuggestions={props.scoreSuggestions} scoreGeneratedAt={props.scoreGeneratedAt} scoreModel={props.scoreModel} radarState={props.radarState} radarError={props.radarError} saveState={props.saveState} assumption={props.assumption} lastWendyAdvice={props.lastWendyAdvice} requestRadarSuggestion={props.requestRadarSuggestion} applyProposedScore={props.applyProposedScore} updateScore={props.updateScore} updateAssumption={props.updateAssumption} updateLastWendyAdvice={props.updateLastWendyAdvice} askWendy={props.askWendy} />
      )}

      {props.activeStep === "test" && (
        <ExperimentsSection experiments={props.experiments} activeExperiment={props.activeExperiment} selectedTemplate={props.selectedTemplate} experimentActionLoading={props.experimentActionLoading} experimentActionError={props.experimentActionError} setSelectedTemplate={props.setSelectedTemplate} setActiveExperimentId={props.setActiveExperimentId} createExperiment={props.createExperiment} duplicateActiveExperiment={props.duplicateActiveExperiment} discardActiveExperiment={props.discardActiveExperiment} createExperimentObjective={props.createExperimentObjective} createExperimentCalendarEvent={props.createExperimentCalendarEvent} completeActiveExperiment={props.completeActiveExperiment} updateActiveExperiment={props.updateActiveExperiment} askWendy={props.askWendy} />
      )}
    </div>
  );
}
