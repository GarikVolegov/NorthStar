/**
 * SpecialistAgent — abstract base class for all domain specialists.
 *
 * WHAT IT DOES
 * ────────────
 * Provides the full RAG + CoT + eval pipeline as a reusable base.
 * Subclasses only need to override:
 *
 *   DOMAIN          string    e.g. 'career'
 *   PERSONA_CORE    string    domain-specific coach persona
 *   TONE_HINT       string    one-line tone instruction
 *   domainWebQuery  function  builds the web search query
 *   buildDomainSection (optional) — extra domain-specific prompt section
 *
 * FLOW
 * ────
 *   1. RAG retrieval (persona examples + domain docs)
 *   2. Web fallback if KB is thin
 *   3. [PARALLEL] CoT + self-eval
 *   4. Build system prompt (base + domain overrides)
 *   5. Stream GPT-4o response
 *
 * REGISTRY
 * ────────
 *   SpecialistRegistry maps Domain → SpecialistAgent instance.
 *   registerSpecialist() adds a specialist.
 *   getSpecialist()      returns the right one (or null → fallback).
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { runChainOfThought } from "./chain-of-thought";
import { evaluateSelf } from "./self-evaluator";
import { buildSystemPrompt } from "./prompt-builder";
import type { UserContext } from "./prompt-builder";
import type { ChatMessage } from "./agent";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { EvalResult } from "./self-evaluator";
import type { Domain, RouteDecision } from "./router-agent";

export const SPECIALIST_MODEL = "gpt-4o";

export interface SpecialistRunOptions {
  userId:          number;
  userContext:     UserContext & { memorySection?: string };
  history:         ChatMessage[];
  userMessage:     string;
  routeDecision:   RouteDecision;
  memoryFactCount?: number;
  maxHistory?:     number;
}

export type SpecialistEvent =
  | { type: "token";  value: string }
  | { type: "done";   sources: RetrievedChunk[]; cot?: CoTResult | null; evalResult?: EvalResult; routeDecision: RouteDecision }
  | { type: "error";  message: string };

// ── Abstract base ─────────────────────────────────────────────────────────────

export abstract class SpecialistAgent {
  abstract readonly DOMAIN:       Domain;
  abstract readonly PERSONA_CORE: string;
  abstract readonly TONE_HINT:    string;

  /** Builds the web search query for this domain */
  abstract domainWebQuery(userMessage: string): string;

  /** Optional: returns an extra domain-specific prompt section */
  buildDomainSection(
    _userMessage: string,
    _cot: CoTResult | null,
    _routeDecision: RouteDecision,
  ): string {
    return "";
  }

  async *run(opts: SpecialistRunOptions): AsyncGenerator<SpecialistEvent> {
    const {
      userId,
      userContext,
      history,
      userMessage,
      routeDecision,
      memoryFactCount = 0,
      maxHistory = 12,
    } = opts;

    const conversationSummary = history
      .slice(-4)
      .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
      .join("\n");

    // ── 1. RAG retrieval ────────────────────────────────────────────────────
    const [personaExamples, documentChunks, cot] = await Promise.all([
      retrieve(userMessage, userId, {
        topK: 3,
        minScore: 0.30,
        sourceTypes: ["persona_example"],
      }),
      retrieve(userMessage, userId, {
        topK: 6,
        minScore: 0.35,
        sourceTypes: ["document", "user_note"],
      }),
      runChainOfThought(userMessage, conversationSummary),
    ]);

    // ── 2. Web fallback ──────────────────────────────────────────────────────
    let webResults: RetrievedChunk[] = [];
    if (documentChunks.length < MIN_LOCAL_CHUNKS) {
      webResults = await searchWeb(this.domainWebQuery(userMessage), 4);
    }

    // ── 3. Self-evaluation ───────────────────────────────────────────────────
    const evalResult = evaluateSelf({
      userMessage,
      documentChunks,
      webResults,
      cot,
      memoryFactCount,
    });

    // ── 4. Build system prompt with domain overrides ──────────────────────────
    // Inject PERSONA_CORE + TONE_HINT + domain section into memorySection slot
    const domainSection = this.buildDomainSection(userMessage, cot, routeDecision);
    const domainHeader = [
      `## Specialista: ${this.DOMAIN.toUpperCase()}`,
      `**Persona**: ${this.PERSONA_CORE}`,
      `**Tono**: ${this.TONE_HINT}`,
      `**Intento rilevato**: ${routeDecision.intent} (confidence: ${routeDecision.confidence.toFixed(2)})`,
      `**Contesto handoff**: ${routeDecision.handoffContext}`,
      domainSection,
    ].filter(Boolean).join("\n");

    const enrichedContext: UserContext & { memorySection?: string } = {
      ...userContext,
      memorySection: [userContext.memorySection, domainHeader]
        .filter(Boolean)
        .join("\n\n"),
    };

    const systemPrompt = buildSystemPrompt({
      userContext:    enrichedContext,
      personaExamples,
      documentChunks,
      webResults,
      cot,
      userMessage,
      evalResult,
    });

    // ── 5. Stream ───────────────────────────────────────────────────────────────
    const recentHistory = history.slice(-maxHistory);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: userMessage },
    ];

    const temperature = evalResult.level === "low" ? 0.45 : 0.72;

    try {
      const stream = await openai.chat.completions.create({
        model:       SPECIALIST_MODEL,
        messages,
        stream:      true,
        temperature,
        max_tokens:  evalResult.level === "low" ? 300 : 700,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) yield { type: "token", value: delta };
      }

      yield {
        type:          "done",
        sources:       [...personaExamples, ...documentChunks, ...webResults],
        cot,
        evalResult,
        routeDecision,
      };
    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

const registry = new Map<Domain, SpecialistAgent>();

export function registerSpecialist(agent: SpecialistAgent): void {
  registry.set(agent.DOMAIN, agent);
  console.log(`[specialist-registry] registered: ${agent.DOMAIN}`);
}

export function getSpecialist(domain: Domain): SpecialistAgent | null {
  return registry.get(domain) ?? null;
}
