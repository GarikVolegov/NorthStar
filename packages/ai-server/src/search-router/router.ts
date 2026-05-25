import { getLLM } from "../llm/client";
import { logger } from "../logger";
import { withTimeout } from "../utils";
import { selectModelFor } from "../model-router";

export interface RouterInput {
  q: string;
  page?: string;
  history?: Array<{ role: string; content: string }>;
}

export interface RouterOutput {
  intent: "explore" | "learn" | "solve" | "compare" | "find_job" | "clarify";
  user_mode: "exploring" | "goal_oriented" | "lost" | "expert";
  experience_level: "beginner" | "intermediate" | "advanced";
  needs_clarification: boolean;
  clarifying_question: string | null;
  ui_widget_type: "results_list" | "chat" | "quick_actions" | "sector_cards";
  retrieval_strategy: "semantic" | "keyword" | "hybrid" | "none";
  confidence: number;
}

const DEFAULT_ROUTE: RouterOutput = {
  intent: "explore",
  user_mode: "exploring",
  experience_level: "beginner",
  needs_clarification: false,
  clarifying_question: null,
  ui_widget_type: "results_list",
  retrieval_strategy: "hybrid",
  confidence: 0.5,
};

const INTENTS = ["explore", "learn", "solve", "compare", "find_job", "clarify"] as const;
const USER_MODES = ["exploring", "goal_oriented", "lost", "expert"] as const;
const EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
const UI_WIDGET_TYPES = ["results_list", "chat", "quick_actions", "sector_cards"] as const;
const RETRIEVAL_STRATEGIES = ["semantic", "keyword", "hybrid", "none"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<const T extends readonly string[]>(
  values: T,
  value: unknown,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && values.includes(value) ? value : fallback;
}

function readRoute(value: unknown): RouterOutput {
  if (!isRecord(value)) return DEFAULT_ROUTE;
  return {
    intent: oneOf(INTENTS, value.intent, DEFAULT_ROUTE.intent),
    user_mode: oneOf(USER_MODES, value.user_mode, DEFAULT_ROUTE.user_mode),
    experience_level: oneOf(
      EXPERIENCE_LEVELS,
      value.experience_level,
      DEFAULT_ROUTE.experience_level,
    ),
    needs_clarification:
      typeof value.needs_clarification === "boolean"
        ? value.needs_clarification
        : false,
    clarifying_question:
      typeof value.clarifying_question === "string"
        ? value.clarifying_question
        : null,
    ui_widget_type: oneOf(
      UI_WIDGET_TYPES,
      value.ui_widget_type,
      DEFAULT_ROUTE.ui_widget_type,
    ),
    retrieval_strategy: oneOf(
      RETRIEVAL_STRATEGIES,
      value.retrieval_strategy,
      DEFAULT_ROUTE.retrieval_strategy,
    ),
    confidence: typeof value.confidence === "number" ? value.confidence : 0.5,
  };
}

const ROUTER_PROMPT = `Sei un AI Router specializzato nell'instradare utenti verso il tool, widget o servizio migliore all'interno di una piattaforma software complessa.

Non devi rispondere come assistente generico.
Devi classificare:
- intento utente
- livello di esperienza
- bisogno immediato
- tolleranza alla complessità
- probabilità che serva una domanda chiarificatrice
- tipo di interfaccia ideale da mostrare

Sulla base dell'input utente, devi produrre SOLO JSON valido con:
{
  "intent": "explore | learn | solve | compare | find_job | clarify",
  "user_mode": "exploring | goal_oriented | lost | expert",
  "experience_level": "beginner | intermediate | advanced",
  "needs_clarification": true|false,
  "clarifying_question": "domanda breve o null",
  "ui_widget_type": "results_list | chat | quick_actions | sector_cards",
  "retrieval_strategy": "semantic | keyword | hybrid | none",
  "confidence": 0.0-1.0
}

Regole:
- sii conservativo con le domande chiarificatrici: falle solo se migliorano davvero il match
- se l'utente sembra perso, privilegia quick wins
- se l'utente è esperto, privilegia strumenti potenti e meno guidati
- non inventare feature inesistenti
- non produrre testo extra fuori dal JSON`;

export async function routeQuery(input: RouterInput): Promise<RouterOutput> {
  if (!input.q || input.q.trim().length < 2) {
    return DEFAULT_ROUTE;
  }

  const contextParts: string[] = [];
  if (input.page) contextParts.push(`Pagina corrente: ${input.page}`);
  if (input.history && input.history.length > 0) {
    const lastFew = input.history.slice(-4);
    contextParts.push(`Ultime interazioni: ${lastFew.map((m) => `[${m.role}] ${m.content.slice(0, 100)}`).join(" | ")}`);
  }
  const contextStr = contextParts.length > 0 ? `\nContesto:\n${contextParts.join("\n")}\n` : "";

  const prompt = `${ROUTER_PROMPT}\n${contextStr}\nInput utente: "${input.q}"\n\nJSON:`;

  try {
    const llm = getLLM();
    const route = selectModelFor("search-router");
    const response = await withTimeout(
      llm.chatOnce(
        [{ role: "system", content: prompt }],
        { model: route.model, temperature: route.temperature, maxTokens: route.maxTokens },
      ),
      5000,
      "search-router",
    );

    const cleaned = response.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return readRoute(JSON.parse(cleaned) as unknown);
  } catch (err) {
    logger.warn({ err, query: input.q }, "search-router fallback to default");
    return DEFAULT_ROUTE;
  }
}
