/**
 * Tipi condivisi del Wendy Router.
 * Importato da tutti i moduli del router: intent-classifier, tool-registry, router.
 */

// ── Intent ────────────────────────────────────────────────────────────────────

/**
 * Classi di complessità operativa — distinte dai domini di Wendy (career, mindset…).
 *
 * navigation   → azione UI, nessuna risposta testuale (NANO)
 * simple_qa    → domanda rapida senza storia (NANO → MICRO se thread aperto)
 * conversation → chat multi-turno normale (STANDARD)
 * planning     → roadmap, obiettivi, percorsi formativi (STANDARD → REASONING)
 * deep_analysis→ analisi complessa, confronti, chain-of-thought (REASONING)
 */
export type WendyIntent =
  | "navigation"
  | "simple_qa"
  | "conversation"
  | "planning"
  | "deep_analysis";

// ── Page context ──────────────────────────────────────────────────────────────

/**
 * Contesto minimo della pagina corrente.
 * Solo dati necessari per disambiguare, mai liste o oggetti pesanti.
 * Il resto viene recuperato on-demand via tool call.
 */
export interface WendyPageContext {
  page:        string;                                          // es. "dashboard", "settore", "coach"
  entityType?: "sector" | "profession" | "article" | "news";
  entityId?:   number;
  entityName?: string;   // es. "Tecnologia & Software" (evita un tool call)
  journeyType?: string;  // es. "dipendente"
}

// ── History compressa ─────────────────────────────────────────────────────────

export interface CompressedHistory {
  summary?:       string;                                        // riassunto bullet dei turni vecchi
  recentMessages: Array<{ role: "user" | "assistant"; content: string }>;
  totalTurns:     number;
}

// ── Tool definitions ──────────────────────────────────────────────────────────

export interface ToolParameter {
  name:        string;
  type:        "string" | "number" | "boolean" | "array";
  description: string;
  required?:   boolean;
}

export interface ToolDefinition {
  name:        string;
  description: string;
  parameters:  ToolParameter[];
}

// ── Router decision ───────────────────────────────────────────────────────────

export interface WendyRouterDecision {
  intent:           WendyIntent;
  tier:             "nano" | "micro" | "standard" | "reasoning";
  model:            string;
  provider:         "openai" | "groq" | "openrouter";
  toolsEnabled:     ToolDefinition[];
  skipFullPipeline: boolean;   // true per navigation/simple_qa → bypassa growth agent
  reasoning:        string;    // debug: "planning keyword detected"
}
