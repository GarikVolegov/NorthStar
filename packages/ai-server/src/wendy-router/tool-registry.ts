/**
 * tool-registry.ts — catalogo dei 17 tool Wendy V1 e mapping intent → tool.
 *
 * Principio: ogni intent riceve solo i tool necessari per ridurre token e allucinazioni.
 * Le descrizioni sono formulate per essere non ambigue (disambiguazione obbligatoria).
 */
import type { WendyIntent, ToolDefinition } from "./types";

import { ALL_TOOLS } from "./tool-definitions";

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
    "search_brain",        // Brain runtime: NorthStar identity/product/process
    "get_weak_signals",    // Step 6: segnali emergenti
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
    "generate_day_scene",
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
    "search_brain",        // Brain runtime: NorthStar identity/product/process
    "get_weak_signals",    // Step 6: anticipare trend nel settore utente
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
    "search_brain",              // Brain runtime: piani su NorthStar identity/product/process
    "get_weak_signals",          // Step 6: ruoli emergenti rilevanti per il piano
    "get_job_posting_trend",     // Step 6: trend domanda per il ruolo target
    "get_skill_cooccurrences",   // Step 6: skill complementari per il piano
    "recall_semantic_memory",    // Plugin memory: recall conversazionale
    "get_rabbit_care_guide",     // Rabbit: guide cura per pianificazione setup
    "search_rabbit_kb",          // Rabbit: knowledge base approfondito
  ],
  deep_analysis: [
    "get_sector_detail",
    "list_sectors",
    "get_profession_detail",
    "generate_day_scene",
    "search_professions",
    "compare_sectors",
    "get_market_trend",
    "get_growth_articles",
    "get_user_context",
    "search_memory_graph",
    "get_user_objectives",
    "search_rag",                // Step 6: analisi profonda con fonti autorevoli
    "search_brain",              // Brain runtime: NorthStar identity/product/process
    "get_weak_signals",          // Step 6: segnali emergenti nel settore
    "get_job_posting_trend",     // Step 6: confronto periodi e crescita domanda
    "get_skill_cooccurrences",   // Step 6: mappa skill correlate
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
              ...(p.type === "array" ? { items: { type: p.itemType ?? "string" } } : {}),
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
