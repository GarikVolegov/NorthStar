/**
 * tool-registry.ts — mappa intent → tool disponibili per quella richiesta.
 *
 * Principio: meno tool = meno token per le definizioni + meno hallucination.
 * Ogni intent riceve solo i tool strettamente necessari.
 *
 * I tool sono definizioni (schema JSON-Schema-like) — l'implementazione
 * effettiva di ogni tool vive in wendy-router/tool-handlers.ts (Phase 2+).
 */
import type { WendyIntent, ToolDefinition } from "./types";

// ── Catalogo tool disponibili ─────────────────────────────────────────────────

const ALL_TOOLS: Record<string, ToolDefinition> = {

  // Navigazione
  navigate: {
    name: "navigate",
    description: "Apre una pagina o sezione specifica dell'app.",
    parameters: [
      { name: "url", type: "string", description: "URL relativo della pagina, es. /settori o /dashboard", required: true },
    ],
  },
  filter_list: {
    name: "filter_list",
    description: "Applica filtri a una lista di settori, ruoli o articoli.",
    parameters: [
      { name: "type", type: "string", description: "Tipo di lista: sectors | professions | articles" },
      { name: "query", type: "string", description: "Query di filtro testuale" },
    ],
  },

  // Recupero dati strutturati (mai nel prompt, sempre via tool)
  get_sector: {
    name: "get_sector",
    description: "Recupera informazioni dettagliate su un settore professionale.",
    parameters: [
      { name: "id", type: "number", description: "ID del settore", required: true },
    ],
  },
  get_profession: {
    name: "get_profession",
    description: "Recupera dettagli su una professione: skill, salario, trend, outlook.",
    parameters: [
      { name: "id", type: "number", description: "ID della professione" },
      { name: "title", type: "string", description: "Nome della professione (alternativo all'id)" },
    ],
  },
  search_professions: {
    name: "search_professions",
    description: "Cerca professioni per parola chiave o compatibilità con il profilo utente.",
    parameters: [
      { name: "query", type: "string", description: "Keyword di ricerca", required: true },
      { name: "sectorId", type: "number", description: "Filtra per settore (opzionale)" },
    ],
  },
  get_user_objectives: {
    name: "get_user_objectives",
    description: "Recupera gli obiettivi attivi dell'utente dal database.",
    parameters: [],
  },
  save_objective: {
    name: "save_objective",
    description: "Salva un nuovo obiettivo professionale per l'utente.",
    parameters: [
      { name: "text", type: "string", description: "Descrizione dell'obiettivo", required: true },
      { name: "category", type: "string", description: "skill | career | learning | habit" },
      { name: "deadlineWeeks", type: "number", description: "Scadenza in settimane da oggi" },
    ],
  },
  get_growth_articles: {
    name: "get_growth_articles",
    description: "Recupera articoli di crescita rilevanti per un argomento.",
    parameters: [
      { name: "topic", type: "string", description: "Argomento di interesse", required: true },
      { name: "limit", type: "number", description: "Numero massimo di articoli (default 3)" },
    ],
  },
  compare_sectors: {
    name: "compare_sectors",
    description: "Confronta due o più settori su dimensioni chiave (salario, trend, autonomia, rischio).",
    parameters: [
      { name: "sectorIds", type: "array", description: "Lista di ID settori da confrontare", required: true },
    ],
  },
  get_market_trend: {
    name: "get_market_trend",
    description: "Recupera trend recenti del mercato del lavoro per un settore o ruolo.",
    parameters: [
      { name: "sectorName", type: "string", description: "Nome del settore" },
      { name: "professionTitle", type: "string", description: "Titolo della professione" },
    ],
  },
  get_news_summary: {
    name: "get_news_summary",
    description: "Recupera le ultime news rilevanti e una sintesi del loro impatto.",
    parameters: [
      { name: "topic", type: "string", description: "Argomento o settore di interesse" },
      { name: "limit", type: "number", description: "Numero di news (default 3)" },
    ],
  },
};

// ── Mapping intent → tool abilitati ──────────────────────────────────────────

const INTENT_TOOLS: Record<WendyIntent, string[]> = {
  navigation:    ["navigate", "filter_list"],
  simple_qa:     ["get_sector", "get_profession", "search_professions"],
  conversation:  ["get_sector", "get_profession", "get_user_objectives", "get_news_summary"],
  planning:      ["get_sector", "get_profession", "search_professions", "get_user_objectives", "save_objective", "get_growth_articles"],
  deep_analysis: ["get_sector", "get_profession", "search_professions", "compare_sectors", "get_market_trend", "get_growth_articles"],
};

/**
 * Restituisce i tool disponibili per un dato intent.
 * Solo i tool necessari per quella classe di richiesta.
 */
export function getToolsForIntent(intent: WendyIntent): ToolDefinition[] {
  const names = INTENT_TOOLS[intent] ?? [];
  return names.map((n) => ALL_TOOLS[n]).filter(Boolean);
}

/**
 * Converte i tool in formato OpenAI function calling.
 * Da usare nel payload verso il LLM.
 */
export function toolsToOpenAIFormat(tools: ToolDefinition[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: object };
}> {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          t.parameters.map((p) => [
            p.name,
            { type: p.type, description: p.description },
          ]),
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));
}
