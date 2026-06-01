import type { WendyTrainingCase, WendyTrainingResponseShapeResult } from "./types";

export function evaluateWendyTrainingResponseShape(
  trainingCase: WendyTrainingCase,
  responseText: string,
): WendyTrainingResponseShapeResult {
  const normalized = normalizeTrainingText(responseText);
  const reasons: string[] = [];

  for (const pattern of trainingCase.badPatterns ?? []) {
    if (normalized.includes(normalizeTrainingText(pattern))) {
      reasons.push(`bad pattern: ${pattern}`);
    }
  }

  const expectedShape = normalizeTrainingText(trainingCase.expectedResponseShape ?? "");
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

function normalizeTrainingText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();
}
