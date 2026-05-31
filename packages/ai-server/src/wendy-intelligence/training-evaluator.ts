import { planWendyDecision } from "./decision-policy";
import { WENDY_TRAINING_CASES } from "./training-cases";
import type {
  WendyCapabilityKey,
  WendyDecision,
  WendyTrainingCase,
  WendyTrainingCaseResult,
  WendyTrainingCategory,
  WendyTrainingCoverage,
  WendyTrainingEvaluation,
  WendyTrainingResponseShapeResult,
} from "./types";

export function evaluateWendyTrainingCase(trainingCase: WendyTrainingCase): WendyTrainingCaseResult {
  const decision = planWendyDecision({
    message: trainingCase.message,
    intent: trainingCase.intent,
  });
  const reasons: string[] = [];

  if (decision.mode !== trainingCase.expectedMode) {
    reasons.push(`mode: expected ${trainingCase.expectedMode}, received ${decision.mode}`);
  }

  if (
    typeof trainingCase.expectedRequiresConfirmation === "boolean" &&
    decision.requiresConfirmation !== trainingCase.expectedRequiresConfirmation
  ) {
    reasons.push(
      `confirmation: expected ${trainingCase.expectedRequiresConfirmation}, received ${decision.requiresConfirmation}`,
    );
  }

  for (const capability of trainingCase.expectedCapabilities ?? []) {
    if (!decision.requiredCapabilities.includes(capability)) {
      reasons.push(`capability: missing ${capability}`);
    }
  }

  return {
    id: trainingCase.id,
    passed: reasons.length === 0,
    decision,
    reasons,
  };
}

export function runWendyTrainingEvaluation(cases: WendyTrainingCase[] = WENDY_TRAINING_CASES): WendyTrainingEvaluation {
  const results = cases.map(evaluateWendyTrainingCase);
  const failures = results.filter((result) => !result.passed);
  const passedCount = results.length - failures.length;
  const coveredCapabilities = collectCoveredCapabilities(cases, results.map((result) => result.decision));

  return {
    passed: failures.length === 0,
    score: results.length === 0 ? 1 : Number((passedCount / results.length).toFixed(2)),
    total: results.length,
    passedCount,
    failures,
    coveredCapabilities,
  };
}

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

export function buildWendyTrainingPromptSection(
  decision: WendyDecision,
  cases: WendyTrainingCase[] = WENDY_TRAINING_CASES,
): string {
  const selected = cases
    .map((trainingCase) => ({
      trainingCase,
      rank: getTrainingCaseRank(trainingCase, decision),
    }))
    .filter(({ rank }) => rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .map(({ trainingCase }) => trainingCase)
    .slice(0, 3);

  if (selected.length === 0) return "";

  const examples = selected
    .map((trainingCase) => {
      const shape = trainingCase.expectedResponseShape
        ? ` | Forma risposta: ${trainingCase.expectedResponseShape}`
        : "";
      const avoid = trainingCase.badPatterns?.length
        ? ` | Evita: ${trainingCase.badPatterns.join(", ")}`
        : "";
      return `- ${trainingCase.id}: input "${trainingCase.message}" => ${trainingCase.expectedMode}.${shape}${avoid}`;
    })
    .join("\n");

  return [
    "## Esempi addestramento Wendy",
    "Usa questi esempi come regressione comportamentale, non come testo da copiare.",
    examples,
  ].join("\n");
}

export function evaluateWendyTrainingResponseShape(
  trainingCase: WendyTrainingCase,
  responseText: string,
): WendyTrainingResponseShapeResult {
  const normalized = normalize(responseText);
  const reasons: string[] = [];

  for (const pattern of trainingCase.badPatterns ?? []) {
    if (normalized.includes(normalize(pattern))) {
      reasons.push(`bad pattern: ${pattern}`);
    }
  }

  const expectedShape = normalize(trainingCase.expectedResponseShape ?? "");
  if (expectedShape.includes("font") && !/\b(fonte|fonti|rag|tool|dati|search_rag)\b/i.test(responseText)) {
    reasons.push("shape: missing source/tool language");
  }
  if (expectedShape.includes("conferma") && !/\b(conferma|ok|procedo|vuoi che)\b/i.test(responseText)) {
    reasons.push("shape: missing confirmation language");
  }

  return {
    id: trainingCase.id,
    passed: reasons.length === 0,
    reasons,
  };
}

function getTrainingCaseRank(trainingCase: WendyTrainingCase, decision: WendyDecision): number {
  let rank = trainingCase.expectedMode === decision.mode ? 10 : 0;
  const meaningfulCapabilities = (trainingCase.expectedCapabilities ?? []).filter(
    (capability) => capability !== "self_check",
  );
  for (const capability of meaningfulCapabilities) {
    if (decision.requiredCapabilities.includes(capability)) rank += 2;
  }
  return rank;
}

function collectCoveredCapabilities(
  cases: WendyTrainingCase[],
  decisions: WendyDecision[],
): WendyCapabilityKey[] {
  const capabilities = new Set<WendyCapabilityKey>();
  for (const decision of decisions) {
    for (const capability of decision.requiredCapabilities) capabilities.add(capability);
  }
  for (const trainingCase of cases) {
    for (const capability of trainingCase.expectedCapabilities ?? []) capabilities.add(capability);
  }
  return [...capabilities].sort();
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

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
