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
      { name: "viewId",     type: "string", description: "dashboard | settori | settore | ruoli | ruolo | news | crescita | percorso | profilo | archivio | coach | calendario | candidature | workspace | validatore | affiliazione", required: true },
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
    description: "Prepara UN NUOVO obiettivo professionale per l'utente. Il salvataggio reale richiede conferma esplicita nel client. Non usare per aggiornare obiettivi esistenti (usare update_objective_progress).",
    parameters: [
      { name: "text",          type: "string", description: "Descrizione chiara dell'obiettivo (max 300 caratteri)", required: true },
      { name: "category",      type: "string", description: "skill | career | learning | habit | altro" },
      { name: "deadlineWeeks", type: "number", description: "Scadenza in settimane da oggi" },
    ],
  },
  update_objective_progress: {
    name:        "update_objective_progress",
    description: "Prepara l'aggiornamento del progresso percentuale (0-100) di un obiettivo ESISTENTE. Richiede l'ID obiettivo noto e conferma esplicita nel client.",
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
    description: "Prepara il salvataggio di una business idea generata durante la conversazione. Il salvataggio reale richiede conferma esplicita nel client.",
    parameters: [
      { name: "title",       type: "string", description: "Titolo breve dell'idea (max 200 char)", required: true },
      { name: "description", type: "string", description: "Descrizione dell'idea (max 500 char)",  required: true },
      { name: "sectorName",  type: "string", description: "Settore di riferimento" },
    ],
  },
  save_memory_fact: {
    name:        "save_memory_fact",
    description: "Prepara un fatto da salvare nella memoria personale di Wendy. Usare solo quando l'utente dichiara una preferenza, obiettivo o fatto stabile e sembra utile ricordarlo. Il salvataggio reale richiede conferma esplicita nel client.",
    parameters: [
      { name: "key",   type: "string", description: "Chiave breve snake_case, es. study_preference | goal_main | constraint_main", required: true },
      { name: "value", type: "string", description: "Fatto in linguaggio naturale, max 300 caratteri", required: true },
    ],
  },
  add_calendar_event: {
    name:        "add_calendar_event",
    description: "Prepara una milestone o scadenza per il calendario dell'utente. L'aggiunta reale richiede conferma esplicita nel client. La data deve essere futura.",
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
  search_memory_graph: {
    name:        "search_memory_graph",
    description: "Cerca nella memoria personale strutturata dell'utente: idee, obiettivi, calendario, profilo e ricordi Wendy. Restituisce nodi, fonti e relazioni con confidence. Usare per domande sul percorso personale o su cosa Wendy ricorda dell'utente.",
    parameters: [
      { name: "query", type: "string", description: "Query semantica sulla memoria personale dell'utente", required: true },
      { name: "limit", type: "number", description: "Max nodi da recuperare (default 6, max 12)" },
      { name: "includeCandidates", type: "boolean", description: "Include relazioni/nodi candidati non ancora confermati" },
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

  // ── Firecrawl: web search / scrape / extract ───────────────────────────────
  web_search: {
    name:        "web_search",
    description: "Ricerca live sul web (Firecrawl). Usare SOLO se search_rag non ha trovato risultati pertinenti o se la query richiede dati attualissimi (news, annunci recenti). Restituisce URL, titolo e snippet.",
    parameters: [
      { name: "query",   type: "string",  description: "Query in linguaggio naturale", required: true },
      { name: "limit",   type: "number",  description: "Max risultati (default 5, max 8)" },
      { name: "country", type: "string",  description: "Codice paese ISO (es. 'it', 'us')" },
      { name: "lang",    type: "string",  description: "Codice lingua (es. 'it', 'en')" },
      { name: "scrape",  type: "boolean", description: "Se true, scarica anche markdown delle pagine (più lento)" },
    ],
  },
  web_scrape_url: {
    name:        "web_scrape_url",
    description: "Scrape di UN SINGOLO URL → markdown pulito (Firecrawl). Usare quando l'utente fornisce un link a un job posting, pagina aziendale o articolo e vuole capirne il contenuto. NON usare per query generiche (usare web_search).",
    parameters: [
      { name: "url",             type: "string",  description: "URL http(s) della pagina", required: true },
      { name: "onlyMainContent", type: "boolean", description: "Estrai solo il contenuto principale (default true)" },
      { name: "waitFor",         type: "number",  description: "Ms da attendere per pagine JS-heavy (max 8000)" },
    ],
  },
  web_extract_structured: {
    name:        "web_extract_structured",
    description: "Estrae dati strutturati da una o più pagine (max 5) seguendo uno schema JSON o un prompt (Firecrawl /extract). Usare per ottenere campi tipizzati (es. lista job posting da una career page con title, location, skills).",
    parameters: [
      { name: "urls",   type: "string", description: "URL singolo o lista separata da virgole (max 5)", required: true },
      { name: "schema", type: "string", description: "Schema JSON dei campi da estrarre (stringified)" },
      { name: "prompt", type: "string", description: "Prompt testuale alternativo/integrativo allo schema" },
    ],
  },

  // ── Personal Intelligence: OpenHuman + Graphify ────────────────────────────
  ask_openhuman_memory: {
    name:        "ask_openhuman_memory",
    description: "Interroga la memoria personale di lungo termine dell'utente in OpenHuman (il suo \"agente personale\" esterno). Usare per domande tipo \"cosa ricordi di me?\", \"cosa abbiamo deciso l'altra volta?\", \"hai memoria di X?\". Restituisce frammenti di memoria con fonte. Se non disponibile, fallisce in modo gentile.",
    parameters: [
      { name: "query", type: "string", description: "Domanda in linguaggio naturale sulla memoria personale dell'utente", required: true },
      { name: "limit", type: "number", description: "Max frammenti (default 5)" },
    ],
  },
  recall_semantic_memory: {
    name:        "recall_semantic_memory",
    description: "Interroga la memoria semantica conversazionale di Wendy (plugin Mem0/Zep se configurato). Usare per ricordare discussioni passate, decisioni implicite, contesto emotivo o preferenze emerse in chat. Se non disponibile, continua senza bloccare.",
    parameters: [
      { name: "query", type: "string", description: "Domanda o tema da cercare nella memoria semantica dell'utente", required: true },
      { name: "limit", type: "number", description: "Max frammenti (default 5)" },
    ],
  },
  explain_app_with_graphify: {
    name:        "explain_app_with_graphify",
    description: "Interroga il knowledge graph del codice di NorthStar (Graphify) per spiegare come funziona una parte dell'app stessa. Usare per \"come funziona X di NorthStar?\", \"dov'è la logica di Y?\", \"quali pagine usano Z?\". Restituisce nodi e relazioni del codice. Disponibile solo se Graphify è abilitato.",
    parameters: [
      { name: "query", type: "string", description: "Domanda sul funzionamento dell'app o su una sua parte (es. \"calendario\", \"validatore di idee\", \"flusso di onboarding\")", required: true },
      { name: "limit", type: "number", description: "Max nodi da recuperare (default 5)" },
    ],
  },
  search_code_graph: {
    name:        "search_code_graph",
    description: "Interroga il grafo Graphify del codice NorthStar. Usare per trovare moduli, file, dipendenze e relazioni architetturali. Capability interna: non modifica codice.",
    parameters: [
      { name: "query", type: "string", description: "Domanda o keyword sul codice (es. 'Wendy routing', 'growth-agent', 'Graphify client')", required: true },
      { name: "limit", type: "number", description: "Max nodi da recuperare (default 5)" },
    ],
  },
  explain_code_node: {
    name:        "explain_code_node",
    description: "Spiega un nodo specifico del grafo codice Graphify tramite graph e id. Usare dopo search_code_graph quando serve dettaglio su un nodo.",
    parameters: [
      { name: "graph", type: "string", description: "Nome grafo Graphify, es. root | apps | packages", required: true },
      { name: "id",    type: "string", description: "ID nodo Graphify da spiegare", required: true },
    ],
  },

  // ── Rabbit expert domain ──────────────────────────────────────────────────────
  get_rabbit_care_guide: {
    name:        "get_rabbit_care_guide",
    description: "Restituisce linee guida certificate sul benessere del coniglio: spazio, alimentazione, socializzazione, salute, arricchimento ambientale, grooming. Usare per domande generali sulla cura. NON usare per emergenze mediche (per quelle interrompi e indirizza al vet).",
    parameters: [
      { name: "topic",     type: "string", description: "housing | feeding | socialization | health | enrichment | grooming", required: true },
      { name: "rabbitAge", type: "string", description: "baby | junior | adult | senior (opzionale)" },
      { name: "breed",     type: "string", description: "Razza del coniglio se rilevante (opzionale)" },
    ],
  },
  check_food_safety: {
    name:        "check_food_safety",
    description: "Verifica se un alimento è sicuro, tossico o da somministrare con cautela per i conigli. USARE OBBLIGATORIAMENTE quando l'utente chiede se può dare un cibo specifico al coniglio.",
    parameters: [
      { name: "foodName", type: "string", description: "Nome dell'alimento da verificare (es. 'carota', 'ciclamino', 'mela', 'prezzemolo')", required: true },
      { name: "quantity", type: "string", description: "Quantità menzionata dall'utente per contestualizzare (opzionale)" },
    ],
  },
  get_breed_info: {
    name:        "get_breed_info",
    description: "Restituisce caratteristiche di una razza di coniglio: temperamento, dimensioni, esigenze specifiche, predisposizioni sanitarie. Usare quando l'utente menziona una razza o chiede quale razza adottare.",
    parameters: [
      { name: "breedName", type: "string", description: "Nome della razza (es. 'Nano Olandese', 'Lop', 'Rex', 'Angora', 'Lionhead', 'Ariete')", required: true },
    ],
  },
  search_rabbit_kb: {
    name:        "search_rabbit_kb",
    description: "Cerca nel knowledge base specializzato sui conigli (veterinaria, comportamento, benessere, legislazione italiana). Usare per domande specifiche non coperte dagli altri tool rabbit.",
    parameters: [
      { name: "query", type: "string", description: "Query semantica in italiano sulla cura o salute dei conigli", required: true },
      { name: "topK",  type: "number", description: "Numero di chunk (default 4, max 8)" },
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
    "web_search",          // Firecrawl: fallback live se RAG vuoto
    "web_scrape_url",      // Firecrawl: leggere un link fornito dall'utente
    "recall_semantic_memory",     // Plugin memory: recall conversazionale
    "ask_openhuman_memory",       // Personal Intelligence: memoria utente
    "explain_app_with_graphify",  // Personal Intelligence: spiegare l'app
    "search_code_graph",
    "get_rabbit_care_guide",      // Rabbit: guide cura
    "check_food_safety",          // Rabbit: sicurezza alimenti
    "get_breed_info",             // Rabbit: info razze
    "search_rabbit_kb",           // Rabbit: knowledge base
  ],
  conversation: [
    "open_view",
    "get_sector_detail",
    "list_sectors",
    "get_profession_detail",
    "search_professions",
    "get_user_objectives",
    "update_objective_progress",
    "get_news_summary",
    "get_market_trend",
    "get_user_context",
    "search_memory_graph",
    "get_growth_articles",
    "add_calendar_event",
    "save_memory_fact",
    "search_rag",          // Step 6: grounding su domande di mercato
    "get_weak_signals",    // Step 6: anticipare trend nel settore utente
    "web_search",          // Firecrawl: dati freschi se RAG insufficiente
    "web_scrape_url",      // Firecrawl: lettura URL forniti dall'utente
    "recall_semantic_memory",     // Plugin memory: recall conversazionale
    "ask_openhuman_memory",       // Personal Intelligence: memoria utente
    "explain_app_with_graphify",  // Personal Intelligence: spiegare l'app
    "search_code_graph",
    "get_rabbit_care_guide",      // Rabbit: guide cura
    "check_food_safety",          // Rabbit: sicurezza alimenti
    "get_breed_info",             // Rabbit: info razze
    "search_rabbit_kb",           // Rabbit: knowledge base
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
    "save_memory_fact",
    "get_user_context",
    "search_memory_graph",
    "search_rag",                // Step 6: grounding per piano basato su dati reali
    "get_weak_signals",          // Step 6: ruoli emergenti rilevanti per il piano
    "get_job_posting_trend",     // Step 6: trend domanda per il ruolo target
    "get_skill_cooccurrences",   // Step 6: skill complementari per il piano
    "web_search",                // Firecrawl: ricerca live per piano formativo
    "web_scrape_url",            // Firecrawl: leggere job posting forniti
    "web_extract_structured",    // Firecrawl: estrarre dati job da career pages
    "recall_semantic_memory",    // Plugin memory: recall conversazionale
    "get_rabbit_care_guide",     // Rabbit: guide cura per pianificazione setup
    "search_rabbit_kb",          // Rabbit: knowledge base approfondito
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
    "search_memory_graph",
    "get_user_objectives",
    "search_rag",                // Step 6: analisi profonda con fonti autorevoli
    "get_weak_signals",          // Step 6: segnali emergenti nel settore
    "get_job_posting_trend",     // Step 6: confronto periodi e crescita domanda
    "get_skill_cooccurrences",   // Step 6: mappa skill correlate
    "web_search",                // Firecrawl: triangolazione con fonti live
    "web_scrape_url",            // Firecrawl: lettura URL specifici
    "web_extract_structured",    // Firecrawl: estrazione strutturata da fonti
    "recall_semantic_memory",     // Plugin memory: recall conversazionale
    "ask_openhuman_memory",       // Personal Intelligence: memoria utente
    "explain_app_with_graphify",  // Personal Intelligence: spiegare l'app
    "search_code_graph",
    "explain_code_node",
    "get_rabbit_care_guide",      // Rabbit: guide cura
    "check_food_safety",          // Rabbit: sicurezza alimenti
    "get_breed_info",             // Rabbit: info razze
    "search_rabbit_kb",           // Rabbit: knowledge base
  ],
};

// ── API pubblica ──────────────────────────────────────────────────────────────

export function getToolsForIntent(intent: WendyIntent): ToolDefinition[] {
  return (INTENT_TOOLS[intent] ?? [])
    .map((n) => ALL_TOOLS[n])
    .filter((tool): tool is ToolDefinition => Boolean(tool));
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

// ── Plugin Tool Registry bootstrap ───────────────────────────────────────────
// Registers all data tools into the unified toolRegistry singleton so that
// isUiTool(), getForIntent(), and all() work correctly across the codebase.

import { toolRegistry } from "../tools/registry";

const WRITE_TOOLS = new Set([
  "save_objective",
  "update_objective_progress",
  "save_business_idea",
  "save_memory_fact",
  "add_calendar_event",
]);

(function bootstrapToolRegistry() {
  // Invert INTENT_TOOLS matrix → per-tool intent list
  const toolIntents = new Map<string, WendyIntent[]>();
  for (const [intent, names] of Object.entries(INTENT_TOOLS) as [WendyIntent, string[]][]) {
    for (const name of names) {
      if (!toolIntents.has(name)) toolIntents.set(name, []);
      toolIntents.get(name)!.push(intent);
    }
  }

  for (const tool of Object.values(ALL_TOOLS)) {
    toolRegistry.register({
      ...tool,
      intents:       toolIntents.get(tool.name) ?? [],
      isUiTool:      false,
      requiresWrite: WRITE_TOOLS.has(tool.name),
    });
  }
})();
