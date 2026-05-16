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
    const parsed = JSON.parse(cleaned);

    return {
      intent: parsed.intent ?? DEFAULT_ROUTE.intent,
      user_mode: parsed.user_mode ?? DEFAULT_ROUTE.user_mode,
      experience_level: parsed.experience_level ?? DEFAULT_ROUTE.experience_level,
      needs_clarification: parsed.needs_clarification ?? false,
      clarifying_question: parsed.clarifying_question ?? null,
      ui_widget_type: parsed.ui_widget_type ?? DEFAULT_ROUTE.ui_widget_type,
      retrieval_strategy: parsed.retrieval_strategy ?? DEFAULT_ROUTE.retrieval_strategy,
      confidence: parsed.confidence ?? 0.5,
    };
  } catch (err) {
    logger.warn({ err, query: input.q }, "search-router fallback to default");
    return DEFAULT_ROUTE;
  }
}
