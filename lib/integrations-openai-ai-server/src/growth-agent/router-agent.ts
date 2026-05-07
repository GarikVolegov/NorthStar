/**
 * RouterAgent v3 — multi-domain detection + adaptive threshold.
 *
 * CHANGES v3
 * ──────────
 * Adds multi-domain routing: when a message spans two domains (e.g. career +
 * mindset: "non riesco a mandare CV per paura del rifiuto"), the router now
 * returns a second RouteDecision in the `secondaryRoute` field.
 *
 * The LLM is asked to optionally identify a secondary domain.
 * If `secondaryDomain` is present in the JSON and its confidence is >= 0.45,
 * agent.ts v7 will fork to ParallelHandoff instead of a single specialist.
 *
 * ROUTING DECISION TABLE:
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * | primary.confidence >= threshold                                            |
 * |   AND secondaryRoute present AND secondaryRoute.confidence >= 0.45        |
 * |   → ParallelHandoff(primary, secondary)                                   |
 * ├────────────────────────────────────────────────────────────────────────────┤
 * | primary.confidence >= threshold AND domain != 'general' (single domain)   |
 * |   → SpecialistAgent(primary)                                               |
 * ├────────────────────────────────────────────────────────────────────────────┤
 * | primary.confidence < threshold OR domain = 'general'                      |
 * |   → GrowthAgent general fallback                                           |
 * └────────────────────────────────────────────────────────────────────────────┘
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
  confidence:      number;    // raw confidence from LLM (0-1)
  threshold:       number;    // adaptive threshold used for routing decision
  reasoning:       string;    // one sentence, dev-facing
  handoffContext:  string;    // short summary passed to specialist
  secondaryRoute?: RouteDecision;  // NEW v3 — optional second domain
}

// ── System prompt ──────────────────────────────────────────────────────────────

const ROUTER_SYSTEM = `
Sei un router intelligente per un sistema multi-agente di coaching.
Il tuo compito è classificare il messaggio dell'utente.

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

IMPORTANTE: se il messaggio tocca CHIARAMENTE due domini distinti, compila anche
i campi secondaryDomain, secondaryConfidence, secondaryIntent, secondaryHandoffContext.
Non forzare un secondo dominio se non è evidente.

Rispondi SOLO con JSON valido:
{
  "domain": "career",
  "intent": "problem_solve",
  "confidence": 0.85,
  "reasoning": "L'utente chiede come negoziare lo stipendio.",
  "handoffContext": "Vuole strategie concrete per la negoziazione salariale.",
  "secondaryDomain": "mindset",
  "secondaryConfidence": 0.60,
  "secondaryIntent": "reflect",
  "secondaryHandoffContext": "Mostra ansia e blocco emotivo legato al chiedere uno stipendio più alto."
}
I campi secondary* sono OPZIONALI. Omettili se il messaggio è chiaramente mono-dominio.
`.trim();

// ── Adaptive threshold (unchanged from v2) ───────────────────────────────────

const BASE_THRESHOLD  = 0.60;
const FLOOR_THRESHOLD = 0.40;
const SECONDARY_MIN_CONFIDENCE = 0.45;

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  career:  ["lavoro", "cv", "colloquio", "stipendio", "carriera", "job", "work", "offerta"],
  mindset: ["credenza", "paura", "blocco", "mente", "pensiero", "psicolog", "belief", "mindset"],
  habits:  ["abitudine", "routine", "produttiv", "sonno", "energia", "focus", "habit"],
  trading: ["trading", "mercato", "xauusd", "forex", "macro", "trade", "borsa", "crypto"],
  general: [],
};

function computeAdaptiveThreshold(
  userMessage: string,
  domain: Domain,
  history: ChatMessage[],
): number {
  let threshold = BASE_THRESHOLD;

  const wordCount = userMessage.trim().split(/\s+/).length;
  if (wordCount < 8) threshold -= 0.08;

  const recentHistory  = history.slice(-6);
  const domainMatchCount = recentHistory.filter(
    (m) => m.role === "assistant" && (m as ChatMessage & { domain?: Domain }).domain === domain,
  ).length;

  const keywords = DOMAIN_KEYWORDS[domain] ?? [];
  const recentUserText = recentHistory
    .filter((m) => m.role === "user")
    .map((m) => m.content.toLowerCase())
    .join(" ");
  const keywordMatches = keywords.filter((kw) => recentUserText.includes(kw)).length;

  if (domainMatchCount >= 2 || keywordMatches >= 2) threshold -= 0.10;

  const final = Math.max(FLOOR_THRESHOLD, threshold);
  if (final < BASE_THRESHOLD) {
    console.log(`[router] adaptive threshold: ${BASE_THRESHOLD} → ${final.toFixed(2)} (words=${wordCount}, dm=${domainMatchCount}, kw=${keywordMatches})`);
  }
  return final;
}

// ── RouterAgent v3 ──────────────────────────────────────────────────────────────────

interface RawRouteResponse {
  domain?:               string;
  intent?:               string;
  confidence?:           number;
  reasoning?:            string;
  handoffContext?:       string;
  secondaryDomain?:      string;
  secondaryConfidence?:  number;
  secondaryIntent?:      string;
  secondaryHandoffContext?: string;
}

export class RouterAgent {
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
        max_tokens:      300,
        response_format: { type: "json_object" },
      });

      const raw    = res.choices[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(raw) as RawRouteResponse;

      const domain: Domain     = (parsed.domain as Domain) ?? "general";
      const confidence: number  = typeof parsed.confidence === "number" ? parsed.confidence : 0;
      const threshold           = computeAdaptiveThreshold(userMessage, domain, history);

      // Build optional secondary route
      let secondaryRoute: RouteDecision | undefined;
      if (
        parsed.secondaryDomain &&
        parsed.secondaryDomain !== domain &&
        parsed.secondaryDomain !== "general" &&
        typeof parsed.secondaryConfidence === "number" &&
        parsed.secondaryConfidence >= SECONDARY_MIN_CONFIDENCE
      ) {
        const secDomain     = parsed.secondaryDomain as Domain;
        const secConfidence = parsed.secondaryConfidence;
        const secThreshold  = computeAdaptiveThreshold(userMessage, secDomain, history);

        secondaryRoute = {
          domain:         secDomain,
          intent:         (parsed.secondaryIntent as Intent) ?? "explore",
          confidence:     secConfidence,
          threshold:      secThreshold,
          reasoning:      "",
          handoffContext: parsed.secondaryHandoffContext ?? userMessage,
        };

        console.log(`[router] multi-domain detected: ${domain}(${confidence.toFixed(2)}) + ${secDomain}(${secConfidence.toFixed(2)})`);
      }

      return {
        domain,
        intent:         (parsed.intent as Intent) ?? "explore",
        confidence,
        threshold,
        reasoning:      parsed.reasoning      ?? "",
        handoffContext: parsed.handoffContext  ?? userMessage,
        secondaryRoute,
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

export const routerAgent = new RouterAgent();
