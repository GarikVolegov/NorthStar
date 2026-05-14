import { getLLM, type LLMMessage } from "../llm/client";
import { commitRoute, loadRoutingContext, logRouteDecision } from "./router-memory";
import { loadMemory } from "./memory-manager";
import type { ChatMessage } from "./agent";
import { logger, type LoggerFields } from "../logger";
import { recordRouterConfidence } from "../metrics";

// ── Types ─────────────────────────────────────────────────────────────────────────

export type Domain =
  | "career"
  | "mindset"
  | "habits"
  | "trading"
  | "finance"
  | "relationships"
  | "health"
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
  isFallback?:     boolean;
  fallbackReason?: string;
}

// ── System prompt v5 ─────────────────────────────────────────────────────────────

const ROUTER_SYSTEM = `
Sei un router intelligente per un sistema multi-agente di coaching.
Il tuo compito è classificare il messaggio dell'utente.

DOMAINS disponibili:
- career:        lavoro, CV, colloqui, stipendio, cambio carriera, networking professionale formale
- mindset:       credenze limitanti, modelli mentali, pattern cognitivi, crescita psicologica
- habits:        abitudini, routine, produttività, gestione energia, sonno, focus
- trading:       operatività attiva su mercati finanziari, psicologia del trading, strategie di trading, analisi tecnica/fondamentale, forex, crypto, macroeconomia, CFD, futures, opzioni, risk management nel trading. BREVE/MEDIO TERMINE, ATTIVO.
- finance:       finanza personale, gestione patrimoniale PASSIVA, budget, risparmio, investimenti ETF, PAC, FIRE, debiti, mutuo, fondo emergenza, pensione integrativa, TFR, ottimizzazione fiscale. LUNGO TERMINE, STRUTTURALE.
- relationships: networking autentico, comunicazione, mentorship, relazioni professionali, conflitti team, leadership
- health:       benessere psicofisico, stress, sonno, alimentazione, attività fisica, burnout, ansia, salute mentale, rilassamento, mindfulness, equilibrio vita-lavoro
- general:       tutto il resto, domande multi-dominio, conversazione generica

INTENTS disponibili:
- explore:       l'utente sta esplorando opzioni, non ha un obiettivo chiaro
- problem_solve: l'utente ha un problema specifico e vuole soluzioni
- plan:          l'utente vuole creare un piano o roadmap
- reflect:       l'utente vuole elaborare emozioni o eventi passati
- vent:          l'utente ha bisogno di essere ascoltato prima di essere guidato — spesso usa frasi emotive ("non ce la faccio più", "sono stanco", "è frustrante")
- ask_info:      l'utente vuole informazioni fattuali

GUIDA INTENT DETECTION:
- Frasi emotive, lamentele, sfoghi → vent o reflect
- Richiesta di numeri, statistiche, definizioni → ask_info
- "Come faccio a...", "qual è il modo migliore per..." → problem_solve
- "Quali sono le opzioni?", "cosa mi consigli?" → explore
- "Fammi un piano", "passo dopo passo", "roadmap" → plan

CHIARIMENTO finance vs trading:
- trading = speculazione attiva, day trading, swing, analisi grafica, entry/exit, leva, margin, stop loss, psicologia del trader. L'utente PARLA DI OPERAZIONI.
- finance = risparmio strutturale, ETF buy&hold, fondo emergenza, budget mensile, ottimizzazione spese. L'utente PARLA DI GESTIONE.

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

// ── Intent-aware threshold config ──────────────────────────────────────────────────

const INTENT_CONFIG: Record<Intent, { base: number; floor: number }> = {
  vent:          { base: 0.50, floor: 0.28 },
  reflect:       { base: 0.50, floor: 0.28 },
  ask_info:      { base: 0.60, floor: 0.40 },
  explore:       { base: 0.60, floor: 0.40 },
  problem_solve: { base: 0.65, floor: 0.45 },
  plan:          { base: 0.70, floor: 0.50 },
};

const SECONDARY_MIN_CONFIDENCE = 0.45;

const DOMAIN_KEYWORDS: Record<Domain, string[]> = {
  career:        ["lavoro", "cv", "colloquio", "stipendio", "carriera", "job", "work", "offerta", "contratto", "assunzione"],
  mindset:       ["credenza", "paura", "blocco", "mente", "pensiero", "psicolog", "belief", "mindset", "ansia", "insicurezza"],
  habits:        ["abitudine", "routine", "produttiv", "sonno", "energia", "focus", "habit", "procrastin", "disciplina"],
  trading:       ["trading", "mercato", "xauusd", "forex", "macro", "trade", "borsa", "crypto", "leva", "margin", "stop loss", "take profit", "volatilità", "short", "long", "analisi tecnica", "supporto", "resistenza", "position sizing", "risk management", "drawdown", "fomo", "revenge", "backtest", "strategia", "setup", "entry", "exit", "tp", "sl"],
  finance:       ["budget", "risparmio", "investimento", "etf", "debito", "banca", "mutuo", "fire", "patrimonio", "soldi", "credito", "interessi", "tasso", "inflazione", "cashflow", "entrate", "uscite", "patrimonio netto", "fondo emergenza", "pensione integrativa", "tfr", "piano accumulo", "pac", "bollo", "capital gain", "plusvalenza", "minusvalenza"],
  relationships: ["networking", "relazione", "comunicazione", "mentore", "conflitto", "linkedin", "collega", "team", "leadership", "collaborazione"],
  health:        ["stress", "sonno", "dormire", "alimentaz", "nutrizione", "dieta", "attività fisica", "palestra", "yoga", "meditazion", "mindfulness", "burnout", "stanco", "affaticamento", "rilassamento", "benessere", "salute", "ansia", "wellness", "respiro"],
  general:       [],
};

// ── Intent-aware adaptive threshold ────────────────────────────────────────────────

const BASE_WORD_COUNT       = 8;
const DOMAIN_HISTORY_BONUS  = 0.10;
const KEYWORD_MATCH_BONUS   = 0.10;

function computeAdaptiveThreshold(
  userMessage: string,
  domain: Domain,
  intent: Intent,
  history: ChatMessage[],
): number {
  const config = INTENT_CONFIG[intent] ?? INTENT_CONFIG.explore;
  let threshold = config.base;

  const wordCount = userMessage.trim().split(/\s+/).length;
  if (wordCount < BASE_WORD_COUNT) threshold -= 0.08;

  const recentHistory = history.slice(-6);
  const domainMatchCount = recentHistory.filter(
    (m) => m.role === "assistant" && (m as ChatMessage & { domain?: Domain }).domain === domain,
  ).length;
  const keywords = DOMAIN_KEYWORDS[domain] ?? [];
  const recentUserText = recentHistory.filter((m) => m.role === "user").map((m) => m.content.toLowerCase()).join(" ");
  const keywordMatches = keywords.filter((kw) => recentUserText.includes(kw)).length;

  if (domainMatchCount >= 2 || keywordMatches >= 2) {
    threshold -= DOMAIN_HISTORY_BONUS;
  }

  // Intent-specific: vent/reflect need very little signal
  if (intent === "vent" || intent === "reflect") {
    const emotionalMarkers = ["non ce la faccio", "sono stanco", "frustrante", "esausto", "bloccato", "paura"];
    const hasEmotional = emotionalMarkers.some((m) => userMessage.toLowerCase().includes(m));
    if (hasEmotional) threshold -= 0.06;
  }

  const final = Math.max(config.floor, threshold);
      if (final < config.base) {
        logger.debug(
          { intent, base: config.base, threshold: final, wordCount, domainMatchCount, keywordMatches },
          "adaptive threshold adjusted",
        );
      }
  return final;
}

// ── RouterAgent v5 ──────────────────────────────────────────────────────────────────────

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
    requestId?: string,
  ): Promise<RouteDecision> {
    const logFields: LoggerFields = { requestId };
    const userId = (history as unknown as { userId?: number })?.userId ?? 0;
    const contextLines = history
      .slice(-4)
      .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
      .join("\n");

    const userContent = contextLines
      ? `Contesto conversazione:\n${contextLines}\n\nMessaggio attuale: ${userMessage}`
      : `Messaggio: ${userMessage}`;

    const routingContext = loadRoutingContext(userId);

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
      const intent: Intent    = (parsed.intent as Intent) ?? "explore";
      const confidence: number = typeof parsed.confidence === "number" ? parsed.confidence : 0;
      const threshold          = computeAdaptiveThreshold(userMessage, domain, intent, history);

      let secondaryRoute: RouteDecision | undefined;
      if (
        parsed.secondaryDomain &&
        parsed.secondaryDomain !== domain &&
        parsed.secondaryDomain !== "general" &&
        typeof parsed.secondaryConfidence === "number" &&
        parsed.secondaryConfidence >= SECONDARY_MIN_CONFIDENCE
      ) {
        const secDomain     = parsed.secondaryDomain as Domain;
        const secIntent     = (parsed.secondaryIntent as Intent) ?? "explore";
        const secConfidence = parsed.secondaryConfidence;
        const secThreshold  = computeAdaptiveThreshold(userMessage, secDomain, secIntent, history);
        secondaryRoute = {
          domain:         secDomain,
          intent:         secIntent,
          confidence:     secConfidence,
          threshold:      secThreshold,
          reasoning:      "",
          handoffContext: parsed.secondaryHandoffContext ?? userMessage,
        };
        logger.info({ ...logFields, domain: secDomain, confidence: secConfidence }, `multi-domain: ${domain} + ${secDomain}`);
      }

      const decision: RouteDecision = {
        domain,
        intent,
        confidence,
        threshold,
        reasoning:      parsed.reasoning      ?? "",
        handoffContext: parsed.handoffContext  ?? userMessage,
        secondaryRoute,
      };

      recordRouterConfidence(decision.domain, decision.intent, decision.confidence);

      if (userId > 0) {
        commitRoute(userId, {
          domain: decision.domain,
          intent: decision.intent,
          confidence: decision.confidence,
          reasoning: decision.reasoning,
        }, userMessage);

        // Persist to DB for dataset analysis
        logRouteDecision(userId, decision, userMessage);
      }

      return decision;
    } catch (err) {
      logger.warn({ err, ...logFields }, "classification failed — falling back to general");
      const fallbackDecision: RouteDecision = {
        domain:         "general",
        intent:         "explore",
        confidence:     0,
        threshold:      INTENT_CONFIG.explore.base,
        reasoning:      "Router error — fallback to general agent",
        handoffContext: userMessage,
        isFallback:     true,
        fallbackReason: err instanceof Error ? err.message : String(err),
      };

      if (userId > 0) {
        logRouteDecision(userId, fallbackDecision, userMessage);
      }

      return fallbackDecision;
    }
  }
}

export const routerAgent = new RouterAgent();
