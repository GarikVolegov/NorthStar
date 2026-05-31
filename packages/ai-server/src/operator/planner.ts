import type { OperatorAction, OperatorPlan, OperatorPlanInput } from "./types";

const SOCIAL_FRAGMENTS = new Set([
  "",
  "!",
  "?",
  "ciao",
  "hey",
  "hello",
  "ok",
  "okay",
  "grazie",
  "yo",
]);

const RECURRING_RE = /\b(ogni|tutte le|tutti i|settiman|mensil|giornal|monitorami|ricordam[i]?|program[ma]?|schedul)\b/i;
const LONG_TASK_RE = /\b(analizza|prepara|report|dettagliat|confronta|strategia|piano operativo|ricerca|valuta)\b/i;

export function planOperatorTask(input: OperatorPlanInput): OperatorPlan {
  const message = input.message ?? "";
  const normalized = normalizeMessage(message);
  const inputSummary = summarizeInput(message, input.triggerType);

  if (input.triggerType === "agent_task_completed") {
    return plan(inputSummary, [
      {
        decision: "memory_update",
        targetType: "memory",
        reason: "Il completamento del task produce conoscenza riusabile per Wendy.",
        metadata: input.metadata,
      },
      {
        decision: "notification",
        targetType: "notification",
        reason: "L'utente deve sapere che il lavoro in background e' pronto.",
        metadata: input.metadata,
      },
    ]);
  }

  if (input.triggerType === "agent_task_failed") {
    return plan(inputSummary, [
      {
        decision: "notification",
        targetType: "notification",
        reason: "Un task agente fallito richiede una notifica non invasiva.",
        metadata: input.metadata,
      },
    ]);
  }

  if (SOCIAL_FRAGMENTS.has(normalized) || normalized.length <= 2) {
    return plan(inputSummary, [
      {
        decision: "reply_now",
        targetType: "wendy",
        reason: "Messaggio breve o sociale: Wendy deve rispondere subito.",
      },
    ]);
  }

  if (RECURRING_RE.test(message)) {
    return plan(inputSummary, [
      {
        decision: "routine",
        targetType: "routine",
        reason: "La richiesta contiene una cadenza o un monitoraggio persistente.",
      },
    ]);
  }

  if (LONG_TASK_RE.test(message) || normalized.length > 160) {
    return plan(inputSummary, [
      {
        decision: "agent_task",
        targetType: "agent_task",
        reason: "Richiesta analitica adatta a esecuzione in background.",
      },
    ]);
  }

  return plan(inputSummary, [
    {
      decision: "reply_now",
      targetType: "wendy",
      reason: "Richiesta conversazionale gestibile nella sessione corrente.",
    },
  ]);
}

function plan(inputSummary: string, actions: OperatorAction[]): OperatorPlan {
  return {
    primaryDecision: actions[0]?.decision ?? "noop",
    actions,
    inputSummary,
  };
}

function normalizeMessage(message: string): string {
  return message
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}!?]+/gu, " ")
    .trim()
    .replace(/\s*[!?]+\s*$/u, "")
    .trim();
}

function summarizeInput(message: string, triggerType: string): string {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (trimmed) return trimmed.slice(0, 240);
  return triggerType;
}
