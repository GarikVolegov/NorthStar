/**
 * RouterAgent v5 — multi-domain detection + adaptive threshold + LLM provider.
 *
 * CHANGES v5:
 * - Uses getLLM() provider instead of hardcoded openai client
 * - Injects routing memory (commit-style) for cross-session consistency
 */
import { getLLM, type LLMMessage } from "../llm/client";
import { commitRoute, loadRoutingContext } from "./router-memory";
import { loadMemory } from "./memory-manager";
import type { ChatMessage } from "./agent";

// ── Types ─────────────────────────────────────────────────────────────────────────

export type Domain =
  | "career"
  | "mindset"
  | "habits"
  | "trading"
  | "finance"        // NEW v4 — finanza personale
  | "relationships"  // NEW v4 — networking + comunicazione
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
  confidence:      number;
  threshold:       number;
  reasoning:       string;
  handoffContext:  string;
  secondaryRoute?: RouteDecision;
}

// ── System prompt v4 ─────────────────────────────────────────────────────────────

const ROUTER_SYSTEM = `
Sei un router intelligente per un sistema multi-agente di coaching.
Il tuo compito è classificare il messaggio dell'utente.

DOMAINS disponibili:
- career:        lavoro, CV, colloqui, stipendio, cambio carriera, networking professionale formale
- mindset:       credenze limitanti, modelli mentali, pattern cognitivi, crescita psicologica
- habits:        abitudini, routine, produttività, gestione energia, sonno, focus
- trading:       mercati finanziari, psicologia del trading, strategie, macro, forex, crypto
- finance:       finanza personale, budget, risparmio, investimenti ETF, FIRE, debiti, stipendio netto
- relationships: networking autentico, comunicazione, mentorship, relazioni professionali, conflitti team
- general:       tutto il resto, domande multi-dominio, conversazione generica

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

NOTA su finance vs trading: finance = gestione del patrimonio personale, risparmio;
trading = speculazione su mercati, analisi tecnica/fondamentale, psychology of trading.

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

// ── Adaptive threshold ───────────────────────────────────────────────────────────────

const BASE_THRESHOLD  = 0.60;
const FLOOR_THRESHOLD = 0.40;
const SECONDARY_MIN_CONFIDENCE = 0.45;

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  career:        ["lavoro", "cv", "colloquio", "stipendio", "carriera", "job", "work", "offerta"],
  mindset:       ["credenza", "paura", "blocco", "mente", "pensiero", "psicolog", "belief", "mindset"],
  habits:        ["abitudine", "routine", "produttiv", "sonno", "energia", "focus", "habit"],
  trading:       ["trading", "mercato", "xauusd", "forex", "macro", "trade", "borsa", "crypto"],
  finance:       ["budget", "risparmio", "investimento", "etf", "debito", "banca", "mutuo", "fire", "patrimonio", "soldi"],
  relationships: ["networking", "relazione", "comunicazione", "mentore", "conflitto", "linkedin", "collega", "team"],
  general:       [],
};

function computeAdaptiveThreshold(
  userMessage: string,
  domain: Domain,
  history: ChatMessage[],
): number {
  let threshold = BASE_THRESHOLD;
  const wordCount = userMessage.trim().split(/\s+/).length;
  if (wordCount < 8) threshold -= 0.08;
  const recentHistory   = history.slice(-6);
  const domainMatchCount = recentHistory.filter(
    (m) => m.role === "assistant" && (m as ChatMessage & { domain?: Domain }).domain === domain,
  ).length;
  const keywords = DOMAIN_KEYWORDS[domain] ?? [];
  const recentUserText = recentHistory.filter((m) => m.role === "user").map((m) => m.content.toLowerCase()).join(" ");
  const keywordMatches = keywords.filter((kw) => recentUserText.includes(kw)).length;
  if (domainMatchCount >= 2 || keywordMatches >= 2) threshold -= 0.10;
  const final = Math.max(FLOOR_THRESHOLD, threshold);
  if (final < BASE_THRESHOLD) {
    console.log(`[router] adaptive threshold: ${BASE_THRESHOLD} → ${final.toFixed(2)} (words=${wordCount}, dm=${domainMatchCount}, kw=${keywordMatches})`);
  }
  return final;
}

// ── RouterAgent v4 ──────────────────────────────────────────────────────────────────────

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

    // Inject routing memory context for cross-session consistency
    const userId = (history as unknown as { userId?: number })?.userId ?? 0;
    const routingContext = loadRoutingContext(userId);

    // Load persistent behavioral patterns from memory
    let behaviorContext = "";
    if (userId > 0) {
      try {
        const userMemory = await loadMemory(userId);
        const highConfidence = userMemory.patterns.filter(
          (p) => p.confidence >= 0.80,
        );
        if (highConfidence.length > 0) {
          behaviorContext =
            "## Pattern comportamentali noti dell'utente\n" +
            highConfidence
              .map(
                (p) =>
                  `- [${p.patternType}] ${p.description}`,
              )
              .join("\n") +
            "\n\nUsa questi pattern per adattare la classificazione del dominio.";
        }
      } catch {
        // Non-critical
      }
    }

    const memoryContext = [routingContext, behaviorContext]
      .filter(Boolean)
      .join("\n\n");

    const systemWithMemory = memoryContext
      ? `${ROUTER_SYSTEM}\n\n${memoryContext}`
      : ROUTER_SYSTEM;

    try {
      const llm = getLLM();
      const result = await llm.chatOnce(
        [
          { role: "system", content: systemWithMemory },
          { role: "user", content: userContent },
        ],
        { model: "gpt-4o-mini", temperature: 0.1, maxTokens: 300 },
      );

      const raw = result ?? "{}";
      const parsed = JSON.parse(raw) as RawRouteResponse;

      const domain: Domain    = (parsed.domain as Domain) ?? "general";
      const confidence: number = typeof parsed.confidence === "number" ? parsed.confidence : 0;
      const threshold          = computeAdaptiveThreshold(userMessage, domain, history);

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
        console.log(`[router v4] multi-domain: ${domain}(${confidence.toFixed(2)}) + ${secDomain}(${secConfidence.toFixed(2)})`);
      }

      const decision: RouteDecision = {
        domain,
        intent:         (parsed.intent as Intent) ?? "explore",
        confidence,
        threshold,
        reasoning:      parsed.reasoning      ?? "",
        handoffContext: parsed.handoffContext  ?? userMessage,
        secondaryRoute,
      };

      // Commit routing decision for future context
      if (userId > 0) {
        commitRoute(userId, {
          domain: decision.domain,
          intent: decision.intent,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
        }, userMessage);
      }

      return decision;
    } catch (err) {
      console.warn("[router v4] classification failed, falling back to general:", err);
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
