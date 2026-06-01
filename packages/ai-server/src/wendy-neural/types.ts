import type { WendyNeuralComponents, WendyNeuralItemKind } from "@workspace/db";
import type { WendyIntent, WendyPageContext } from "../wendy-router/types";

export type ActivationDomain = string | null | undefined;
export type WendyIntentLike = WendyIntent | (string & {});

export interface ActivationCandidate {
  itemKind: WendyNeuralItemKind;
  itemRef: string;
  label: string;
  components: WendyNeuralComponents;
  metadata?: Record<string, unknown> | undefined;
  content?: string | undefined;
}

export interface ScoredActivationItem {
  itemKind: WendyNeuralItemKind;
  itemRef: string;
  label: string;
  score: number;
  components?: WendyNeuralComponents | undefined;
  selected?: boolean;
  metadata?: Record<string, unknown> | undefined;
  content?: string | undefined;
}

export interface WendyActivationContext {
  traceId: string;
  requestId: string;
  userId: number;
  messageHash: string;
  intent: WendyIntentLike;
  domain?: string | null;
  activeItems: ScoredActivationItem[];
  activeTools: string[];
  promptSection: string;
  selectedRefs: string[];
  activationSummary: {
    traceId: string;
    items: Array<{
      kind: WendyNeuralItemKind;
      ref: string;
      label: string;
      score: number;
      selected: boolean;
    }>;
    tools: string[];
  };
  memorySection?: string;
  wendyBrainSection?: string;
}

export interface BuildWendyActivationInput {
  requestId: string;
  userId: number;
  message: string;
  intent: WendyIntentLike;
  domain?: ActivationDomain;
  pageContext?: WendyPageContext | undefined;
}

export interface ReinforceCoActivationsInput {
  userId?: number | null;
  requestId: string;
  items: ScoredActivationItem[];
}

export const DEFAULT_COMPONENTS: WendyNeuralComponents = {
  semantic: 0,
  userRelevance: 0,
  graphProximity: 0,
  recency: 0,
  salience: 0,
  trust: 0,
};
