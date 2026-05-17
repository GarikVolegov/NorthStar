/**
 * tool-registry.ts — catalogo dei 17 tool Wendy V1 e mapping intent → tool.
 *
 * Principio: ogni intent riceve solo i tool necessari per ridurre token e allucinazioni.
 * Le descrizioni sono formulate per essere non ambigue (disambiguazione obbligatoria).
 */
import type { WendyIntent, ToolDefinition } from "./types";

// ── Catalogo completo ─────────────────────────────────────────────────────────

const ALL_TOOLS: Record<string, ToolDefinition> = {

  // ── Navigazione (client-side, mai dati DB) ──────────────────────────────────
  open_view: {
    name:        "open_view",
    description: "Naviga l'utente a una pagina specifica dell'app. Usare SOLO quando l'utente chiede esplicitamente di andare da qualche parte. Non combinare con altri tool nella stessa risposta.",
    parameters: [
      { name: "viewId",     type: "string", description: "dashboard | settori | settore | ruoli | ruolo | news | crescita | percorso | profilo | archivio | coach", required: true },
      { name: "entityId",   type: "number", description: "ID del settore o professione se viewId = settore/ruolo" },
      { name: "entityName", type: "string", description: "Nome dell'entità (per URL SEO)" },
    ],
  },
  set_filters: {
    name:        "set_filters",
    description: "Applica filtri su una lista GIÀ APERTA (non apre nuova pagina). Usare dopo open_view, mai da solo per navigare.",
    parameters: [
      { name: "listType", type: "string",  description: "sectors | professions | news | articles", required: true },
      { name: "filters",  type: "string",  description: "JSON con filtri: trend, automationRisk, salaryMin, riasecTypes, keyword" },
    ],
  },

  // ── Settori ─────────────────────────────────────────────────────────────────
  get_sector_detail: {
    name:        "get_sector_detail",
    description: "Restituisce dati strutturati di UN SINGOLO settore: skill, salari, trend, automazione, opportunità. Usare quando si conosce già il sectorId.",
    parameters: [
      { name: "sectorId", type: "number", description: "ID numerico del settore", required: true },
    ],
  },
  list_sectors: {
    name:        "list_sectors",
    description: "Restituisce lista compatta di settori filtrabili per trend o crescita. Usare per esplorare o suggerire settori senza ID noto.",
    parameters: [
      { name: "trend", type: "string", description: "Filtra per: growing | booming | stable | declining" },
      { name: "limit", type: "number", description: "Max risultati (default 5)" },
    ],
  },

  // ── Professioni ─────────────────────────────────────────────────────────────
  get_profession_detail: {
    name:        "get_profession_detail",
    description: "Restituisce dati strutturati di UNA SINGOLA professione: skill, salario, growth outlook, RIASEC. Usare quando si conosce già il professionId.",
    parameters: [
      { name: "professionId", type: "number", description: "ID numerico della professione", required: true },
    ],
  },
  search_professions: {
    name:        "search_professions",
    description: "Cerca professioni per keyword testuale o nome di skill. Usare quando NON si conosce l'ID della professione.",
    parameters: [
      { name: "query",    type: "string", description: "Keyword: titolo, skill o descrizione ruolo", required: true },
      { name: "sectorId", type: "number", description: "Restringe la ricerca a un settore" },
      { name: "limit",    type: "number", description: "Max risultati (default 5)" },
    ],
  },
  compare_sectors: {
    name:        "compare_sectors",
    description: "Confronta da 2 a 4 settori su salario, trend, automazione e autonomia. Richiede ALMENO 2 ID settori noti.",
    parameters: [
      { name: "sectorIds", type: "array", description: "Array di 2-4 ID settori interi", required: true },
    ],
  },

  // ── Mercato ─────────────────────────────────────────────────────────────────
  get_market_trend: {
    name:        "get_market_trend",
    description: "Recupera segnali operativi dal mercato del lavoro (skill emergenti, opportunità di carriera) da fonti aggregate. Diverso da get_news_summary che è editoriale.",
    parameters: [
      { name: "sectorName",      type: "string", description: "Nome del settore di interesse" },
      { name: "professionTitle", type: "string", description: "Titolo della professione di interesse" },
      { name: "limit",           type: "number", description: "Max risultati (default 3)" },
    ],
  },

  // ── Obiettivi utente ─────────────────────────────────────────────────────────
  get_user_objectives: {
    name:        "get_user_objectives",
    description: "Legge gli obiettivi attivi e il loro progresso per l'utente corrente. Chiamare al massimo una volta per turno.",
    parameters: [
      { name: "limit", type: "number", description: "Max obiettivi da restituire (default 10)" },
    ],
  },
  save_objective: {
    name:        "save_objective",
    description: "Crea UN NUOVO obiettivo professionale per l'utente. Non usare per aggiornare obiettivi esistenti (usare update_objective_progress).",
    parameters: [
      { name: "text",          type: "string", description: "Descrizione chiara dell'obiettivo (max 300 caratteri)", required: true },
      { name: "category",      type: "string", description: "skill | career | learning | habit | altro" },
      { name: "deadlineWeeks", type: "number", description: "Scadenza in settimane da oggi" },
    ],
  },
  update_objective_progress: {
    name:        "update_objective_progress",
    description: "Aggiorna il progresso percentuale (0-100) di un obiettivo ESISTENTE. Richiede l'ID obiettivo noto.",
    parameters: [
      { name: "objectiveId", type: "number", description: "ID dell'obiettivo da aggiornare", required: true },
      { name: "progress",    type: "number", description: "Percentuale completamento 0-100", required: true },
    ],
  },

  // ── Contenuti ────────────────────────────────────────────────────────────────
  get_growth_articles: {
    name:        "get_growth_articles",
    description: "Cerca articoli di crescita personale e professionale per argomento. Restituisce link a contenuti della piattaforma.",
    parameters: [
      { name: "topic", type: "string", description: "Argomento o keyword di interesse", required: true },
      { name: "limit", type: "number", description: "Max articoli (default 3)" },
    ],
  },
  get_news_summary: {
    name:        "get_news_summary",
    description: "Recupera notizie giornalistiche recenti con sintesi per un topic. Diverso da get_market_trend che è operativo.",
    parameters: [
      { name: "topic", type: "string", description: "Argomento o settore della news", required: true },
      { name: "limit", type: "number", description: "Max news (default 3)" },
    ],
  },
  get_learning_paths: {
    name:        "get_learning_paths",
    description: "Recupera percorsi formativi strutturati (universitari, online, bootcamp) per una professione o settore target.",
    parameters: [
      { name: "professionId", type: "number", description: "ID professione target" },
      { name: "sectorName",   type: "string", description: "Nome settore (alternativo all'ID)" },
    ],
  },

  // ── Scrittura dominio ────────────────────────────────────────────────────────
  save_business_idea: {
    name:        "save_business_idea",
    description: "Salva una business idea generata durante la conversazione nel profilo utente.",
    parameters: [
      { name: "title",       type: "string", description: "Titolo breve dell'idea (max 200 char)", required: true },
      { name: "description", type: "string", description: "Descrizione dell'idea (max 500 char)",  required: true },
      { name: "sectorName",  type: "string", description: "Settore di riferimento" },
    ],
  },
  add_calendar_event: {
    name:        "add_calendar_event",
    description: "Aggiunge una milestone o scadenza al calendario dell'utente. La data deve essere futura.",
    parameters: [
      { name: "title", type: "string", description: "Titolo dell'evento",          required: true },
      { name: "date",  type: "string", description: "Data in formato YYYY-MM-DD",   required: true },
      { name: "type",  type: "string", description: "study | training | interview | deadline | task | follow-up" },
      { name: "notes", type: "string", description: "Note opzionali" },
    ],
  },

  // ── Contesto utente ──────────────────────────────────────────────────────────
  get_user_context: {
    name:        "get_user_context",
    description: "Legge il profilo compatto dell'utente: tipo percorso, obiettivi attivi, fatti biografici, settori preferiti. Chiamare al massimo UNA VOLTA per sessione.",
    parameters: [],
  },

  // ── Step 6: RAG + Job Market Intelligence ──────────────────────────────────
  search_rag: {
    name:        "search_rag",
    description: "Cerca nel knowledge base RAG (report WEF, LinkedIn, ONET, news) con ricerca semantica. USARE OBBLIGATORIAMENTE per domande su trend di mercato, ruoli emergenti, statistiche di settore. Restituisce chunk con fonte e data per citazione.",
    parameters: [
      { name: "query",   type: "string", description: "Query semantica in italiano o inglese", required: true },
      { name: "filters", type: "string", description: "JSON opzionale: { geography: ['IT','EU'], sourceTypes: ['report','news'], minTrustScore: 0.6, maxAgeMonths: 24 }" },
      { name: "topK",    type: "number", description: "Numero di chunk da recuperare (default 5, max 10)" },
    ],
  },
  get_weak_signals: {
    name:        "get_weak_signals",
    description: "Recupera segnali deboli di professioni o skill emergenti (nuovi ruoli, skill insolite, trend nascenti). Utile per rispondere a domande su futuro del lavoro e ruoli emergenti.",
    parameters: [
      { name: "sectorId",  type: "string", description: "ID settore per filtrare i segnali (opzionale)" },
      { name: "status",    type: "string", description: "emerging | confirmed (default: confirmed)" },
      { name: "geography", type: "string", description: "Filtra per area geografica: IT | EU | US" },
      { name: "limit",     type: "number", description: "Max segnali (default 5)" },
    ],
  },
  get_job_posting_trend: {
    name:        "get_job_posting_trend",
    description: "Recupera l'andamento nel tempo degli annunci di lavoro per un ruolo specifico. Utile per domande su crescita di un ruolo, confronto periodi, evoluzione della domanda.",
    parameters: [
      { name: "roleTitle",    type: "string", description: "Titolo del ruolo (es. 'Data Engineer')" },
      { name: "professionId", type: "number", description: "ID professione (alternativo a roleTitle)" },
      { name: "geography",    type: "string", description: "Area geografica: IT | EU | US | Global", required: true },
      { name: "periods",      type: "array",  description: "Array di periodi YYYY-MM (es. ['2024-10','2025-01'])", required: true },
    ],
  },
  get_skill_cooccurrences: {
    name:        "get_skill_cooccurrences",
    description: "Restituisce le skill che compaiono più spesso insieme a una skill data negli annunci di lavoro. Utile per suggerire skill complementari e costruire piani di studio.",
    parameters: [
      { name: "skillName",    type: "string", description: "Nome della skill principale (es. 'Python')", required: true },
      { name: "professionId", type: "number", description: "Restringe al contesto di una professione specifica" },
      { name: "limit",        type: "number", description: "Max skill correlate (default 8)" },
    ],
  },
};

// ── Matrice intent → tool abilitati ──────────────────────────────────────────

const INTENT_TOOLS: Record<WendyIntent, string[]> = {
  navigation: [
    "open_view",
    "set_filters",
  ],
  simple_qa: [
    "get_sector_detail",
    "list_sectors",
    "get_profession_detail",
    "search_professions",
    "get_news_summary",
    "search_rag",          // Step 6: grounding RAG per domande su trend/ruoli
    "get_weak_signals",    // Step 6: segnali emergenti
  ],
  conversation: [
    "get_sector_detail",
    "get_profession_detail",
    "search_professions",
    "get_user_objectives",
    "update_objective_progress",
    "get_news_summary",
    "get_market_trend",
    "get_user_context",
    "get_growth_articles",
    "search_rag",          // Step 6: grounding su domande di mercato
    "get_weak_signals",    // Step 6: anticipare trend nel settore utente
  ],
  planning: [
    "get_sector_detail",
    "list_sectors",
    "get_profession_detail",
    "search_professions",
    "get_user_objectives",
    "save_objective",
    "update_objective_progress",
    "get_growth_articles",
    "get_learning_paths",
    "get_market_trend",
    "save_business_idea",
    "add_calendar_event",
    "get_user_context",
    "search_rag",                // Step 6: grounding per piano basato su dati reali
    "get_weak_signals",          // Step 6: ruoli emergenti rilevanti per il piano
    "get_job_posting_trend",     // Step 6: trend domanda per il ruolo target
    "get_skill_cooccurrences",   // Step 6: skill complementari per il piano
  ],
  deep_analysis: [
    "get_sector_detail",
    "list_sectors",
    "get_profession_detail",
    "search_professions",
    "compare_sectors",
    "get_market_trend",
    "get_growth_articles",
    "get_user_context",
    "get_user_objectives",
    "search_rag",                // Step 6: analisi profonda con fonti autorevoli
    "get_weak_signals",          // Step 6: segnali emergenti nel settore
    "get_job_posting_trend",     // Step 6: confronto periodi e crescita domanda
    "get_skill_cooccurrences",   // Step 6: mappa skill correlate
  ],
};

// ── API pubblica ──────────────────────────────────────────────────────────────

export function getToolsForIntent(intent: WendyIntent): ToolDefinition[] {
  return (INTENT_TOOLS[intent] ?? [])
    .map((n) => ALL_TOOLS[n])
    .filter(Boolean);
}

export function toolsToOpenAIFormat(tools: ToolDefinition[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: object };
}> {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name:        t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          t.parameters.map((p) => [
            p.name,
            { type: p.type === "array" ? "array" : p.type, description: p.description,
              ...(p.type === "array" ? { items: { type: "integer" } } : {}),
            },
          ]),
        ),
        required: t.parameters.filter((p) => p.required).map((p) => p.name),
      },
    },
  }));
}
