/**
 * RouterAgent v2 — adaptive confidence threshold.
 *
 * CHANGES v2
 * ──────────
 * The routing threshold is no longer a fixed 0.60.
 * It adapts dynamically based on two signals:
 *
 *   1. MESSAGE LENGTH — short messages (<8 words) are naturally ambiguous.
 *      A short message like "non so cosa fare" deserves the specialist even
 *      at confidence 0.52. Threshold lowered by 0.08 for short messages.
 *
 *   2. DOMAIN CONTINUITY — if the last 4 turns already established a domain
 *      (e.g. we've been talking about career for 3 exchanges), a borderline
 *      message should stay in that domain. Threshold lowered by 0.10 if
 *      the same domain appears ≥2 times in recent assistant turns.
 *
 * FLOOR: threshold never goes below 0.40 to prevent routing garbage.
 * CEILING: base threshold remains 0.60.
 *
 * RESULT:
 *   Short + in-context message: threshold can reach 0.42 (0.60 - 0.08 - 0.10)
 *   Short only:                  0.52
 *   In-context only:             0.50
 *   Normal (no signals):         0.60
 */
import { openai } from "../client";
import type { ChatMessage } from "./agent";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Domain =
  | "career"
  | "mindset"
  | "habits"
  | "trading"
  | "general";

export type Intent =
  | "explore"
  | "problem_solve"
  | "plan"
  | "reflect"
  | "vent"
  | "ask_info";

export interface RouteDecision {
  domain:          Domain;
  intent:          Intent;
  confidence:      number;  // raw confidence from LLM (0-1)
  threshold:       number;  // adaptive threshold used for routing decision
  reasoning:       string;  // one sentence, dev-facing
  handoffContext:  string;  // short summary passed to specialist
}

// ── System prompt ──────────────────────────────────────────────────────────────

const ROUTER_SYSTEM = `
Sei un router intelligente per un sistema multi-agente di coaching.
Il tuo unico compito è classificare il messaggio dell'utente.

DOMAINS disponibili:
- career:   lavoro, CV, colloqui, stipendio, cambio carriera, networking
- mindset:  credenze limitanti, modelli mentali, pattern cognitivi, crescita psicologica
- habits:   abitudini, routine, produttività, gestione energia, sonno, focus
- trading:  mercati finanziari, psicologia del trading, strategie, macro
- general:  tutto il resto, domande multi-dominio, conversazione generica

INTENTS disponibili:
- explore:       l'utente sta esplorando opzioni, non ha un obiettivo chiaro
- problem_solve: l'utente ha un problema specifico e vuole soluzioni
- plan:          l'utente vuole creare un piano o roadmap
- reflect:       l'utente vuole elaborare emozioni o eventi passati
- vent:          l'utente ha bisogno di essere ascoltato prima di essere guidato
- ask_info:      l'utente vuole informazioni fattuali

Rispondi SOLO con JSON valido (nessun testo fuori dal JSON):
{
  "domain": "career",
  "intent": "problem_solve",
  "confidence": 0.85,
  "reasoning": "L'utente chiede consigli specifici su come negoziare lo stipendio in un colloquio.",
  "handoffContext": "L'utente affronta un colloquio e vuole strategie concrete per la negoziazione salariale."
}
`.trim();

// ── Adaptive threshold ──────────────────────────────────────────────────────────

const BASE_THRESHOLD = 0.60;
const FLOOR_THRESHOLD = 0.40;

/**
 * Computes the routing confidence threshold dynamically.
 *
 * @param userMessage  The current user message
 * @param domain       The domain returned by the LLM
 * @param history      Recent conversation turns
 * @returns            Threshold (0.40 – 0.60)
 */
function computeAdaptiveThreshold(
  userMessage: string,
  domain: Domain,
  history: ChatMessage[],
): number {
  let threshold = BASE_THRESHOLD;

  // Signal 1: Short messages are naturally ambiguous — lower the bar
  const wordCount = userMessage.trim().split(/\s+/).length;
  if (wordCount < 8) {
    threshold -= 0.08;
  }

  // Signal 2: Domain continuity in recent assistant turns
  // We store domain on messages when available (cast to extended type)
  const recentHistory = history.slice(-6);
  const domainMatchCount = recentHistory.filter(
    (m) => m.role === "assistant" && (m as ChatMessage & { domain?: Domain }).domain === domain,
  ).length;

  // Also check if recent user messages contain domain keywords
  const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
    career:  ["lavoro", "lavoro", "cv", "colloquio", "stipendio", "carriera", "job", "work", "offerta"],
    mindset: ["credenza", "paura", "blocco", "mente", "pensiero", "psicolog", "belief", "mindset"],
    habits:  ["abitudine", "routine", "produttiv", "sonno", "energia", "focus", "habit"],
    trading: ["trading", "mercato", "xauusd", "forex", "macro", "trade", "borsa", "crypto"],
    general: [],
  };

  const keywords = DOMAIN_KEYWORDS[domain] ?? [];
  const recentUserText = recentHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");

  const keywordMatches = keywords.filter((kw) => recentUserText.includes(kw)).length;

  if (domainMatchCount >= 2 || keywordMatches >= 2) {
    threshold -= 0.10;
  }

  const final = Math.max(FLOOR_THRESHOLD, threshold);

  if (final < BASE_THRESHOLD) {
    console.log(
      `[router] adaptive threshold: ${BASE_THRESHOLD} → ${final.toFixed(2)} ` +
      `(words=${wordCount}, domainMatch=${domainMatchCount}, kwMatch=${keywordMatches})`,
    );
  }

  return final;
}

// ── RouterAgent class ───────────────────────────────────────────────────────────────

export class RouterAgent {
  /**
   * Classifies the user message and returns a RouteDecision.
   * Uses last 4 turns of history for context.
   * Falls back to { domain: 'general', confidence: 0 } on any error.
   */
  async route(
    userMessage: string,
    history: ChatMessage[] = [],
  ): Promise<RouteDecision> {
    const contextLines = history
      .slice(-4)
      .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
      .join("\n");

    const userContent = contextLines
      ? `Contesto conversazione:\n${contextLines}\n\nMessaggio attuale: ${userMessage}`
      : `Messaggio: ${userMessage}`;

    try {
      const res = await openai.chat.completions.create({
        model:           "gpt-4o-mini",
        messages: [
          { role: "system", content: ROUTER_SYSTEM },
          { role: "user",   content: userContent },
        ],
        temperature:     0.1,
        max_tokens:      200,
        response_format: { type: "json_object" },
      });

      const raw    = res.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as Partial<RouteDecision>;

      const domain: Domain    = (parsed.domain as Domain) ?? "general";
      const confidence: number = typeof parsed.confidence === "number" ? parsed.confidence : 0;

      // Compute adaptive threshold AFTER we know the domain
      const threshold = computeAdaptiveThreshold(userMessage, domain, history);

      return {
        domain,
        intent:         (parsed.intent as Intent) ?? "explore",
        confidence,
        threshold,
        reasoning:      parsed.reasoning      ?? "",
        handoffContext: parsed.handoffContext  ?? userMessage,
      };
    } catch (err) {
      console.warn("[router] classification failed, falling back to general:", err);
      return {
        domain:         "general",
        intent:         "explore",
        confidence:     0,
        threshold:      BASE_THRESHOLD,
        reasoning:      "Router error — fallback to general agent",
        handoffContext: userMessage,
      };
    }
  }
}

// Singleton
export const routerAgent = new RouterAgent();
