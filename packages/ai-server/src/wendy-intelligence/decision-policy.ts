import type { WendyCapabilityKey, WendyDecision, WendyDecisionInput } from "./types";

const SOCIAL_RE = /^(ciao|hey|hello|ok|okay|grazie|yo|!|\?|ciao!|hey!|ok!)$/i;
const MEMORY_RE = /\b(ricordati|ricorda che|memorizza|tieni a mente|preferisco|non voglio|mi piace|per me e importante)\b/i;
const ROUTINE_RE = /\b(ogni|tutte le|tutti i|settiman|mensil|giornal|monitorami|avvisami|ricordam[i]?|program[ma]?|schedul)\b/i;
const ACTION_RE = /\b(crea\w*|aggiung\w*|modific\w*|elimin\w*|spost\w*|salv\w*|pianific\w*|impost\w*|segna come)\b/i;
const MARKET_RE = /\b(settor\w*|mercato|trend|salari|stipendi|rischio ai|automazione|professioni emergenti|crescit\w*)\b/i;
const LONG_ANALYSIS_RE = /\b(analizza|prepara|report|dettagliat|strategia|confronta|valuta|piano operativo|ricerca)\b/i;

export function planWendyDecision(input: WendyDecisionInput): WendyDecision {
  const message = input.message.trim();
  const normalized = normalize(message);

  if (SOCIAL_RE.test(normalized) || normalized.length <= 2) {
    return decision("reply_now", ["social_presence", "self_check"], false, 900, "Messaggio sociale o frammento breve.");
  }

  if (MEMORY_RE.test(message)) {
    return decision("memory_update", ["long_term_memory", "self_check"], false, 1500, "L'utente sta esprimendo una preferenza persistente.");
  }

  if (ROUTINE_RE.test(message)) {
    return decision("routine", ["routine_scheduler", "operator_layer", "self_check"], true, 2000, "La richiesta contiene cadenza o monitoraggio continuativo.");
  }

  if (ACTION_RE.test(message)) {
    return decision("tool_action", ["northstar_actions", "tool_discipline", "self_check"], true, 1800, "La richiesta implica una mutazione o azione nell'app.");
  }

  if (LONG_ANALYSIS_RE.test(message) || normalized.length > 180 || input.intent === "deep_analysis") {
    const capabilities: WendyCapabilityKey[] = ["operator_layer", "tool_discipline", "self_check"];
    if (MARKET_RE.test(message)) capabilities.splice(1, 0, "market_intelligence");
    return decision("agent_task", capabilities, false, 2500, "Richiesta analitica o lunga: meglio lavoro asincrono/task agente.");
  }

  if (MARKET_RE.test(message)) {
    return decision("tool_action", ["market_intelligence", "tool_discipline", "self_check"], false, 1800, "Richiesta dati mercato: servono tool/fonti.");
  }

  return decision("reply_now", ["social_presence", "tool_discipline", "self_check"], false, 1500, "Richiesta conversazionale gestibile subito.");
}

function decision(
  mode: WendyDecision["mode"],
  requiredCapabilities: WendyCapabilityKey[],
  requiresConfirmation: boolean,
  latencyTargetMs: number,
  reason: string,
): WendyDecision {
  return { mode, requiredCapabilities, requiresConfirmation, latencyTargetMs, reason };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}!?]+/gu, " ")
    .trim();
}
