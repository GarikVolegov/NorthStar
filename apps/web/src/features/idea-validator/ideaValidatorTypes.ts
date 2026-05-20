export type IdeaStatus = "draft" | "in_validation" | "validated" | "discarded";
export type SaveState = "idle" | "saving" | "saved" | "error";
export type RadarState = "idle" | "loading" | "error";
export type ExperimentAction = "objective" | "calendar" | "reminder" | "complete";
export type ScoreKey = "problem" | "audience" | "solution" | "market" | "execution";
export type CanvasKey =
  | "problem"
  | "customer"
  | "solution"
  | "differentiation"
  | "channels"
  | "monetization"
  | "evidence"
  | "risks";
export type ExperimentStatus = "planned" | "running" | "completed" | "discarded";
export type GuidedStep = "describe" | "sense" | "test" | "decide";
export type DecisionState =
  | "unclear"
  | "needs_test"
  | "promising"
  | "validated"
  | "discard"
  | "ready_for_ops";
export type TimelineEventType =
  | "idea_created"
  | "canvas_updated"
  | "wendy_feedback"
  | "experiment_created"
  | "experiment_completed"
  | "score_updated"
  | "status_changed"
  | "decision_changed";

export type TimelineEvent = {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};

export type MarketInsight = {
  currentAlternative: string;
  pricingPositioning: string;
  strengthsWeaknesses: string;
  opportunities: string;
};

export type CompetitorEntry = {
  id: string;
  name: string;
  url: string;
  positioning: string;
  price: string;
  strengths: string;
  weaknesses: string;
  opportunity: string;
  createdAt: string;
  updatedAt: string;
};

export type GuidedExperiment = {
  id: string;
  template: string;
  title: string;
  objective: string;
  hypothesis: string;
  metric: string;
  expectedResult: string;
  deadline: string;
  outcome: string;
  status: ExperimentStatus;
  objectiveId?: number;
  calendarEventId?: number;
  reminderEventId?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type DecisionSuggestion = {
  state: DecisionState;
  reason: string;
  confidence: number;
  nextActions: string[];
  generatedAt: string;
  model: string;
};

export type IdeaValidationData = {
  canvas?: Partial<Record<CanvasKey, string>> & Record<string, string | undefined>;
  scores?: Partial<Record<ScoreKey, number>>;
  scoreReasons?: Partial<Record<ScoreKey, string>>;
  scoreSuggestions?: Partial<Record<ScoreKey, string>>;
  scoreGeneratedAt?: string;
  scoreModel?: string;
  assumption?: string;
  experiment?: string;
  experiments?: GuidedExperiment[];
  activeExperimentId?: string;
  market?: Partial<MarketInsight>;
  competitors?: CompetitorEntry[];
  activeCompetitorId?: string;
  lastWendyAdvice?: string;
  timeline?: TimelineEvent[];
  decisionState?: DecisionState | undefined;
  decisionReason?: string;
  decisionUpdatedAt?: string;
  decisionSuggested?: DecisionSuggestion | undefined;
  oneLiner?: string;
  uiVersion?: string;
};

export type BusinessIdea = {
  id: number;
  title: string;
  ideaText: string;
  status: IdeaStatus;
  validationScore: number | null;
  validationData: IdeaValidationData | null;
  createdAt: string;
  updatedAt: string;
};

export type RadarSuggestion = {
  scores: Record<ScoreKey, number>;
  reasons: Record<ScoreKey, string>;
  suggestions: Record<ScoreKey, string>;
  generatedAt: string;
  model: string;
};
