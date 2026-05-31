import type { WendyIntent } from "../wendy-router/types";

export type WendyDecisionMode =
  | "reply_now"
  | "tool_action"
  | "agent_task"
  | "routine"
  | "memory_update"
  | "clarify";

export type WendyReasoningDepth = "instant" | "grounded" | "deliberate";

export type WendyDataStrategy =
  | "none"
  | "profile"
  | "market"
  | "profile_market"
  | "app_action"
  | "memory";

export type WendyExecutionMode =
  | "direct_chat"
  | "tool_augmented_chat"
  | "background_agent"
  | "scheduled_routine"
  | "memory_capture";

export type WendyCapabilityKey =
  | "social_presence"
  | "tool_discipline"
  | "long_term_memory"
  | "operator_layer"
  | "routine_scheduler"
  | "northstar_actions"
  | "market_intelligence"
  | "self_check";

export type WendyTrainingCategory =
  | "social"
  | "market"
  | "memory"
  | "routine"
  | "action"
  | "agent"
  | "emotional";

export interface WendyCapability {
  key: WendyCapabilityKey;
  label: string;
  directive: string;
  failureMode: string;
}

export interface WendyDecisionInput {
  message: string;
  intent?: WendyIntent | string | undefined;
  page?: string | undefined;
  hasFileAttached?: boolean | undefined;
}

export interface WendyDecision {
  mode: WendyDecisionMode;
  requiredCapabilities: WendyCapabilityKey[];
  requiresConfirmation: boolean;
  latencyTargetMs: number;
  reason: string;
  reasoningDepth: WendyReasoningDepth;
  dataStrategy: WendyDataStrategy;
  executionMode: WendyExecutionMode;
  selfCheck: string[];
}

export interface WendySuggestedPrompt {
  label: string;
  prompt: string;
}

export interface WendySelfCheckIssue {
  code:
    | "empty_response"
    | "forbidden_template_phrase"
    | "missing_sources_for_market_claim"
    | "unsafe_action_without_confirmation"
    | "too_many_questions";
  severity: "low" | "medium" | "high";
  message: string;
}

export interface WendySelfCheckInput {
  userMessage: string;
  responseText: string;
  decision: WendyDecision;
  contextSources?: string[] | undefined;
}

export interface WendySelfCheckResult {
  ok: boolean;
  score: number;
  rubric: WendyResponseRubric;
  issues: WendySelfCheckIssue[];
  repairHint?: string | undefined;
}

export interface WendyResponseRubric {
  completeness: number;
  actionability: number;
  sourceDiscipline: number;
  tone: number;
  safety: number;
}

export interface WendyTrainingCase {
  id: string;
  message: string;
  intent: WendyIntent | string;
  expectedMode: WendyDecisionMode;
  expectedCapabilities?: WendyCapabilityKey[] | undefined;
  expectedRequiresConfirmation?: boolean | undefined;
  expectedResponseShape?: string | undefined;
  badPatterns?: string[] | undefined;
  why: string;
}

export interface WendyTrainingCaseResult {
  id: string;
  passed: boolean;
  decision: WendyDecision;
  reasons: string[];
}

export interface WendyTrainingResponseShapeResult {
  id: string;
  passed: boolean;
  reasons: string[];
}

export interface WendyTrainingEvaluation {
  passed: boolean;
  score: number;
  total: number;
  passedCount: number;
  failures: WendyTrainingCaseResult[];
  coveredCapabilities: WendyCapabilityKey[];
}

export interface WendyTrainingCoverage {
  passed: boolean;
  byCategory: Record<WendyTrainingCategory, number>;
  missingCategories: WendyTrainingCategory[];
}
