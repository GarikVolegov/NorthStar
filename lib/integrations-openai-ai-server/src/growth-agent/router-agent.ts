/**
 * RouterAgent — classifies user messages and routes to the right specialist.
 *
 * WHAT IT DOES
 * ────────────
 * Reads the last user message + last 4 conversation turns, then uses
 * GPT-4o-mini (JSON mode, fast + cheap) to return:
 *
 *   domain      — which specialist should handle this
 *   intent      — what the user is trying to accomplish
 *   confidence  — 0-1, how certain the router is
 *   reasoning   — one-sentence explanation (used in dev logs)
 *   handoffContext — short summary to pass to the specialist
 *
 * ROUTING RULES
 * ─────────────
 *   confidence >= 0.60  → route to specialist
 *   confidence <  0.60  → fallback to general (monolithic) agent
 *   domain = 'general'  → always fallback
 *
 * DOMAINS
 * ───────
 *   career    Job search, CV, interviews, salary, career pivots, networking
 *   mindset   Limiting beliefs, mental models, cognitive patterns, growth
 *   habits    Habit formation, routines, productivity, energy, sleep
 *   trading   Market analysis, trading psychology, strategy (future specialist)
 *   general   Everything else, multi-domain, unclear
 *
 * INTENTS
 * ───────
 *   explore        User is exploring options, no clear goal yet
 *   problem_solve  User has a specific problem and wants solutions
 *   plan           User wants to create a plan / roadmap
 *   reflect        User wants to process emotions or past events
 *   vent           User needs to be heard first, then coached
 *   ask_info       User wants factual information
 */
import { openai } from "../client";
import type { ChatMessage } from "./agent";

// ── Types ────────────────────────────────────────────────────────────────────

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
  domain:         Domain;
  intent:         Intent;
  confidence:     number;   // 0-1
  reasoning:      string;   // one sentence, dev-facing
  handoffContext: string;   // short summary passed to specialist
}

// ── System prompt ────────────────────────────────────────────────────────────

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

// ── RouterAgent class ────────────────────────────────────────────────────────

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
    // Build compact context (last 4 turns)
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

      return {
        domain:         (parsed.domain as Domain)         ?? "general",
        intent:         (parsed.intent as Intent)         ?? "explore",
        confidence:     typeof parsed.confidence === "number" ? parsed.confidence : 0,
        reasoning:      parsed.reasoning      ?? "",
        handoffContext: parsed.handoffContext  ?? userMessage,
      };
    } catch (err) {
      console.warn("[router] classification failed, falling back to general:", err);
      return {
        domain:         "general",
        intent:         "explore",
        confidence:     0,
        reasoning:      "Router error — fallback to general agent",
        handoffContext: userMessage,
      };
    }
  }
}

// Singleton
export const routerAgent = new RouterAgent();
