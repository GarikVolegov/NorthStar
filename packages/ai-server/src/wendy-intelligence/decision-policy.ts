import type {
  WendyCapabilityKey,
  WendyDataStrategy,
  WendyDecision,
  WendyDecisionInput,
  WendyDecisionMode,
  WendyExecutionMode,
  WendyReasoningDepth,
} from "./types";

const SOCIAL_RE = /^(ciao|hey|hello|ok|okay|grazie|yo|!|\?|ciao!|hey!|ok!)$/i;
const MEMORY_RE = /\b(ricordati|ricorda che|memorizza|tieni a mente|preferisco|non voglio|mi piace|per me e importante)\b/i;
const ROUTINE_RE = /\b(ogni|tutte le|tutti i|settiman|mensil|giornal|monitorami|avvisami|ricordam[i]?|program[ma]?|schedul)\b/i;
const ACTION_RE = /\b(crea\w*|aggiung\w*|modific\w*|elimin\w*|spost\w*|salv\w*|pianific\w*|impost\w*|segna come)\b/i;
const MARKET_RE = /\b(settor\w*|sector\w*|mercato|market|trend|salari|salary|salaries|stipendi|rischio ai|ai risk|automazione|automation|professioni emergenti|emerging professions|crescit\w*|growth)\b/i;
const PROFILE_RE = /\b(profilo|profile|adatt[ioe]|fit|compatibil\w*|compatib\w*|preferenze|preferences|riasec|test|obiettiv\w*|objective\w*|goal\w*|progressi|progress|per me|for me|my|miei|mie|gi[aà] fatto|ho gi[aà] fatto|l'ho gi[aà] fatto|l ho gi[aà] fatto|already did|already done)\b/i;
const NEXT_ACTION_RE = /\b(cosa|che)\b.*\b(fare|faccio)\b.*\b(oggi|domani|settimana)\b|\b(what|which)\b.*\b(do|should)\b.*\b(today|tomorrow|week)\b|\bprossim[ao]\b.*\b(azion\w*|pass\w*|moss\w*)\b|\bnext\b.*\b(step|action|move)\b|\bprogressi\b/i;
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
    return decision("tool_action", ["northstar_actions", "tool_discipline", "self_check"], true, 1800, "La richiesta implica una mutazione o azione nell'app.", message);
  }

  if (NEXT_ACTION_RE.test(message)) {
    return decision("tool_action", ["long_term_memory", "tool_discipline", "self_check"], false, 1600, "La richiesta chiede una prossima azione basata sul profilo o sugli obiettivi.", message);
  }

  if (LONG_ANALYSIS_RE.test(message) || normalized.length > 180 || input.intent === "deep_analysis") {
    const capabilities: WendyCapabilityKey[] = ["operator_layer", "tool_discipline", "self_check"];
    if (MARKET_RE.test(message)) capabilities.splice(1, 0, "market_intelligence");
    return decision("agent_task", capabilities, false, 2500, "Richiesta analitica o lunga: meglio lavoro asincrono/task agente.", message);
  }

  if (MARKET_RE.test(message)) {
    const capabilities: WendyCapabilityKey[] = ["market_intelligence", "tool_discipline", "self_check"];
    if (PROFILE_RE.test(message)) capabilities.unshift("long_term_memory");
    return decision("tool_action", capabilities, false, 1800, "Richiesta dati mercato: servono tool/fonti.", message);
  }

  return decision("reply_now", ["social_presence", "tool_discipline", "self_check"], false, 1500, "Richiesta conversazionale gestibile subito.", message);
}

function decision(
  mode: WendyDecisionMode,
  requiredCapabilities: WendyCapabilityKey[],
  requiresConfirmation: boolean,
  latencyTargetMs: number,
  reason: string,
  message = "",
): WendyDecision {
  return {
    mode,
    requiredCapabilities,
    requiresConfirmation,
    latencyTargetMs,
    reason,
    reasoningDepth: inferReasoningDepth(mode),
    dataStrategy: inferDataStrategy(mode, requiredCapabilities, message),
    executionMode: inferExecutionMode(mode),
    selfCheck: inferSelfCheck(mode, requiredCapabilities),
  };
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}!?]+/gu, " ")
    .trim();
}

function inferReasoningDepth(mode: WendyDecisionMode): WendyReasoningDepth {
  if (mode === "reply_now") return "instant";
  if (mode === "agent_task" || mode === "routine") return "deliberate";
  return "grounded";
}

function inferExecutionMode(mode: WendyDecisionMode): WendyExecutionMode {
  if (mode === "agent_task") return "background_agent";
  if (mode === "routine") return "scheduled_routine";
  if (mode === "memory_update") return "memory_capture";
  if (mode === "tool_action") return "tool_augmented_chat";
  return "direct_chat";
}

function inferDataStrategy(
  mode: WendyDecisionMode,
  capabilities: WendyCapabilityKey[],
  message: string,
): WendyDataStrategy {
  if (mode === "memory_update") return "memory";
  if (mode === "routine" || capabilities.includes("northstar_actions")) return "app_action";
  const needsMarket = capabilities.includes("market_intelligence") || MARKET_RE.test(message);
  const needsProfile = capabilities.includes("long_term_memory") || PROFILE_RE.test(message);
  if (needsMarket && needsProfile) return "profile_market";
  if (needsMarket) return "market";
  if (needsProfile) return "profile";
  return "none";
}

function inferSelfCheck(mode: WendyDecisionMode, capabilities: WendyCapabilityKey[]): string[] {
  const checks = new Set<string>(["non_empty", "specific_next_step"]);
  if (mode === "tool_action" || capabilities.includes("market_intelligence")) checks.add("grounded_sources");
  if (mode === "agent_task") checks.add("handoff_clear");
  if (mode === "routine") checks.add("schedule_clear");
  if (capabilities.includes("northstar_actions")) checks.add("confirmation_before_mutation");
  return [...checks];
}
