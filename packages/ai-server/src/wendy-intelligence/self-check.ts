import { WENDY_FORBIDDEN_PHRASES } from "../wendy-voice";
import type { WendyResponseRubric, WendySelfCheckInput, WendySelfCheckIssue, WendySelfCheckResult } from "./types";

const MARKET_RE = /\b(settor\w*|mercato|trend|salari|stipendi|rischio ai|automazione|professioni|crescit\w*|cybersecurity|design|sanit\w*)\b/i;
const NUMERIC_CLAIM_RE = /\b\d+(?:[,.]\d+)?\s?(?:%|k|mila|eur|euro)(?=\W|$)/i;

export function evaluateWendyResponse(input: WendySelfCheckInput): WendySelfCheckResult {
  const issues: WendySelfCheckIssue[] = [];
  const text = input.responseText.trim();

  if (!text) {
    issues.push({
      code: "empty_response",
      severity: "high",
      message: "La risposta e' vuota o non e' stata emessa.",
    });
  }

  const forbidden = WENDY_FORBIDDEN_PHRASES.find((phrase) =>
    text.toLocaleLowerCase("it-IT").includes(phrase.toLocaleLowerCase("it-IT")),
  );
  if (forbidden) {
    issues.push({
      code: "forbidden_template_phrase",
      severity: "medium",
      message: `Formula troppo generica: ${forbidden}`,
    });
  }

  const needsSources =
    MARKET_RE.test(input.userMessage) ||
    input.decision.requiredCapabilities.includes("market_intelligence") ||
    NUMERIC_CLAIM_RE.test(text);
  if (needsSources && !hasSource(input.contextSources, text)) {
    issues.push({
      code: "missing_sources_for_market_claim",
      severity: "high",
      message: "Le affermazioni di mercato o numeriche devono citare almeno una fonte/tool.",
    });
  }

  if (input.decision.requiresConfirmation && /\b(fatto|ho creato|ho modificato|ho eliminato|salvato)\b/i.test(text)) {
    issues.push({
      code: "unsafe_action_without_confirmation",
      severity: "high",
      message: "Una mutazione che richiede conferma sembra gia' eseguita.",
    });
  }

  const questionCount = (text.match(/\?/g) ?? []).length;
  if (questionCount > 1) {
    issues.push({
      code: "too_many_questions",
      severity: "low",
      message: "Wendy dovrebbe fare al massimo una domanda di follow-up.",
    });
  }

  const rubric = buildRubric({ text, issues });
  const penalty = issues.reduce((sum, issue) => sum + (issue.severity === "high" ? 0.35 : issue.severity === "medium" ? 0.2 : 0.1), 0);
  const score = Math.max(0, Number((1 - penalty).toFixed(2)));
  const ok = issues.every((issue) => issue.severity !== "high");
  return {
    ok,
    score,
    rubric,
    issues,
    repairHint: ok ? undefined : buildWendyRepairHint({ ok, score, rubric, issues }),
  };
}

function hasSource(contextSources: string[] | undefined, text: string): boolean {
  if (contextSources?.length) return true;
  return /\b(fonte|fonti|search_rag|graphify|openhuman|job_posting|weak_signal|rag)\b/i.test(text);
}

export function buildWendyRepairHint(result: WendySelfCheckResult): string {
  if (result.ok) return "";
  const fixes = result.issues.map((issue) => {
    if (issue.code === "missing_sources_for_market_claim") {
      return "aggiungi fonti/tool RAG oppure dichiara che il dato non e' verificato";
    }
    if (issue.code === "unsafe_action_without_confirmation") {
      return "fermati e chiedi conferma prima di modificare dati";
    }
    if (issue.code === "empty_response") {
      return "emettere una risposta breve ma completa";
    }
    if (issue.code === "forbidden_template_phrase") {
      return "riscrivi con voce Wendy concreta, senza formule generiche";
    }
    return "riduci le domande e dai un prossimo passo chiaro";
  });

  return `Correggi prima di chiudere: ${[...new Set(fixes)].join("; ")}.`;
}

function buildRubric(input: { text: string; issues: WendySelfCheckIssue[] }): WendyResponseRubric {
  const hasIssue = (code: WendySelfCheckIssue["code"]) =>
    input.issues.some((issue) => issue.code === code);
  return {
    completeness: input.text ? 0.85 : 0,
    actionability: hasIssue("too_many_questions") ? 0.55 : input.text.length > 30 ? 0.85 : 0.65,
    sourceDiscipline: hasIssue("missing_sources_for_market_claim") ? 0.2 : 0.9,
    tone: hasIssue("forbidden_template_phrase") ? 0.45 : 0.9,
    safety: hasIssue("unsafe_action_without_confirmation") ? 0.2 : 0.9,
  };
}
