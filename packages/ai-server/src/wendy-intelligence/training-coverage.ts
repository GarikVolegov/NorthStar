import { WENDY_TRAINING_CASES } from "./training-cases";
import type { WendyTrainingCase, WendyTrainingCategory, WendyTrainingCoverage } from "./types";

export function getWendyTrainingCoverage(cases: WendyTrainingCase[] = WENDY_TRAINING_CASES): WendyTrainingCoverage {
  const byCategory: Record<WendyTrainingCategory, number> = {
    social: 0,
    market: 0,
    memory: 0,
    routine: 0,
    action: 0,
    agent: 0,
    emotional: 0,
  };

  for (const trainingCase of cases) {
    for (const category of inferTrainingCategories(trainingCase)) {
      byCategory[category] += 1;
    }
  }

  const missingCategories = (Object.keys(byCategory) as WendyTrainingCategory[]).filter(
    (category) => byCategory[category] === 0,
  );

  return {
    passed: missingCategories.length === 0,
    byCategory,
    missingCategories,
  };
}

function inferTrainingCategories(trainingCase: WendyTrainingCase): WendyTrainingCategory[] {
  const categories = new Set<WendyTrainingCategory>();
  const capabilities = trainingCase.expectedCapabilities ?? [];
  const text = `${trainingCase.id} ${trainingCase.message} ${trainingCase.expectedResponseShape ?? ""}`.toLowerCase();

  if (trainingCase.expectedMode === "reply_now" || capabilities.includes("social_presence")) {
    categories.add("social");
  }
  if (trainingCase.expectedMode === "agent_task" || capabilities.includes("operator_layer")) {
    categories.add("agent");
  }
  if (trainingCase.expectedMode === "routine" || capabilities.includes("routine_scheduler")) {
    categories.add("routine");
  }
  if (trainingCase.expectedMode === "memory_update" || capabilities.includes("long_term_memory")) {
    categories.add("memory");
  }
  if (capabilities.includes("northstar_actions")) {
    categories.add("action");
  }
  if (capabilities.includes("market_intelligence")) {
    categories.add("market");
  }
  if (/\b(emotion|frustrat|bloccato|perso|iniziare)\b/i.test(text)) {
    categories.add("emotional");
  }

  return [...categories];
}
