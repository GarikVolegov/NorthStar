/**
 * SpecialistAgent v4 — SSE status events + memory wired.
 *
 * CHANGES v4
 * ──────────
 * Adds 'status' SSE events at each meaningful pipeline step.
 * The domain-aware messages tell the user EXACTLY what the agent is doing:
 *
 *   "💼 Carico il tuo profilo carriera..."
 *   "🔍 Cerco nella knowledge base..."
 *   "🌐 Cerco fonti aggiornate..."
 *   "🧠 Analizzando la situazione..."
 *   "✨ Sto scrivendo la risposta..."
 *   "🔄 Revisione qualità in corso..."
 *
 * Domain icons are resolved from DOMAIN_STATUS_ICONS at runtime.
 * Memory wiring from v3 is preserved unchanged.
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { runChainOfThought } from "./chain-of-thought";
import { evaluateSelf } from "./self-evaluator";
import { buildSystemPrompt } from "./prompt-builder";
import { supervisorAgent } from "./supervisor-agent";
import { loadMemory, buildMemorySection, extractMemory, mergeMemory } from "./memory-manager";
import type { SupervisorResult } from "./supervisor-agent";
import type { UserContext } from "./prompt-builder";
import type { ChatMessage } from "./agent";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { EvalResult } from "./self-evaluator";
import type { Domain, RouteDecision } from "./router-agent";

export const SPECIALIST_MODEL = "gpt-4o";

// Domain-specific status icon for the first status message
const DOMAIN_STATUS_ICONS: Record<Domain, string> = {
  career:  "💼",
  mindset: "🧠",
  habits:  "🌱",
  trading: "📈",
  finance: "💰",
  relationships: "🤝",
  general: "✨",
};

const DOMAIN_LABELS: Record<Domain, string> = {
  career:  "profilo carriera",
  mindset: "profilo mindset",
  habits:  "profilo abitudini",
  trading: "profilo trading",
  finance: "profilo finanziario",
  relationships: "profilo relazionale",
  general: "profilo",
};

export interface SpecialistRunOptions {
  userId:           number;
  userContext:      UserContext & { memorySection?: string };
  history:          ChatMessage[];
  userMessage:      string;
  routeDecision:    RouteDecision;
  memoryFactCount?: number;
  maxHistory?:      number;
}

export type SpecialistEvent =
  | { type: "token";  value: string }
  | { type: "status"; value: string }           // ← NEW v4
  | { type: "done";   sources: RetrievedChunk[]; cot?: CoTResult | null; evalResult?: EvalResult; routeDecision: RouteDecision; supervisorResult?: SupervisorResult }
  | { type: "error";  message: string };

// ── Abstract base ─────────────────────────────────────────────────────────────

export abstract class SpecialistAgent {
  abstract readonly DOMAIN:       Domain;
  abstract readonly PERSONA_CORE: string;
  abstract readonly TONE_HINT:    string;

  abstract domainWebQuery(userMessage: string): string;

  buildDomainSection(
    _userMessage: string,
    _cot: CoTResult | null,
    _routeDecision: RouteDecision,
  ): string {
    return "";
  }

  async *run(opts: SpecialistRunOptions): AsyncGenerator<SpecialistEvent> {
    const {
      userId, userContext, history, userMessage,
      routeDecision, maxHistory = 12,
    } = opts;

    const icon  = DOMAIN_STATUS_ICONS[this.DOMAIN] ?? "✨";
    const label = DOMAIN_LABELS[this.DOMAIN] ?? "profilo";

    // ── 0. Memory ───────────────────────────────────────────────────────────
    yield { type: "status", value: `${icon} Carico il tuo ${label}...` };

    let resolvedMemorySection = userContext.memorySection ?? "";
    let memoryFactCount = opts.memoryFactCount ?? 0;

    if (!resolvedMemorySection) {
      try {
        const userMemory    = await loadMemory(userId);
        resolvedMemorySection = buildMemorySection(userMemory);
        memoryFactCount     = userMemory.facts.length;
      } catch (err) {
        console.warn(`[specialist:${this.DOMAIN}] memory load failed:`, err instanceof Error ? err.message : err);
      }
    }

    const conversationSummary = history
      .slice(-4)
      .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
      .join("\n");

    // ── 1. RAG ────────────────────────────────────────────────────────────────
    yield { type: "status", value: "🔍 Cerco nella knowledge base..." };

    const [personaExamples, documentChunks, cot] = await Promise.all([
      retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["persona_example"] }),
      retrieve(userMessage, userId, { topK: 6, minScore: 0.35, sourceTypes: ["document", "user_note"] }),
      runChainOfThought(userMessage, conversationSummary),
    ]);

    // ── 2. Web fallback ───────────────────────────────────────────────────────
    let webResults: RetrievedChunk[] = [];
    if (documentChunks.length < MIN_LOCAL_CHUNKS) {
      yield { type: "status", value: "🌐 Cerco fonti aggiornate sul web..." };
      webResults = await searchWeb(this.domainWebQuery(userMessage), 4);
    }

    // ── 3. Self-eval + CoT result ───────────────────────────────────────────────
    yield { type: "status", value: "🧠 Analizzando la situazione..." };

    const evalResult = evaluateSelf({ userMessage, documentChunks, webResults, cot, memoryFactCount });

    // ── 4. System prompt ──────────────────────────────────────────────────────
    const domainSection = this.buildDomainSection(userMessage, cot, routeDecision);
    const domainHeader  = [
      `## Specialista: ${this.DOMAIN.toUpperCase()}`,
      `**Persona**: ${this.PERSONA_CORE}`,
      `**Tono**: ${this.TONE_HINT}`,
      `**Intento rilevato**: ${routeDecision.intent} (confidence: ${routeDecision.confidence.toFixed(2)})`,
      `**Contesto handoff**: ${routeDecision.handoffContext}`,
      domainSection,
    ].filter(Boolean).join("\n");

    const combinedMemory = [resolvedMemorySection, domainHeader].filter(Boolean).join("\n\n");
    const enrichedContext: UserContext & { memorySection?: string } = {
      ...userContext,
      memorySection: combinedMemory,
    };

    const systemPrompt = buildSystemPrompt({
      userContext: enrichedContext, personaExamples, documentChunks,
      webResults, cot, userMessage, evalResult,
    });

    // ── 5. Stream + BUFFER ────────────────────────────────────────────────────
    const recentHistory = history.slice(-maxHistory);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system",    content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user",      content: userMessage },
    ];

    const temperature = evalResult.level === "low" ? 0.45 : 0.72;

    try {
      yield { type: "status", value: "✨ Sto scrivendo la risposta..." };

      const stream = await openai.chat.completions.create({
        model: SPECIALIST_MODEL, messages, stream: true, temperature,
        max_tokens: evalResult.level === "low" ? 300 : 700,
      });

      const tokenBuffer: string[] = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) tokenBuffer.push(delta);
      }

      const draft = tokenBuffer.join("");

      // ── 6. Supervisor gate ──────────────────────────────────────────────────
      const supervisorInput = { userMessage, draft, domain: routeDecision.domain, intent: routeDecision.intent };
      let supervisorResult  = supervisorAgent.evaluate(supervisorInput);
      let finalText         = draft;

      if (!supervisorResult.pass) {
        yield { type: "status", value: "🔄 Revisione qualità in corso..." };
        console.log(`[supervisor] FAIL (score=${supervisorResult.score})`);
        finalText        = await supervisorAgent.rewrite(supervisorInput, supervisorResult);
        supervisorResult = { ...supervisorResult, rewritten: true };
      } else {
        console.log(`[supervisor] PASS (score=${supervisorResult.score})`);
      }

      // ── 7. Stream final text ────────────────────────────────────────────────
      const CHUNK_SIZE = 4;
      for (let i = 0; i < finalText.length; i += CHUNK_SIZE) {
        yield { type: "token", value: finalText.slice(i, i + CHUNK_SIZE) };
      }

      yield {
        type: "done", sources: [...personaExamples, ...documentChunks, ...webResults],
        cot, evalResult, routeDecision, supervisorResult,
      };

      // ── 8. Fire-and-forget memory save ──────────────────────────────────────
      const sessionId = Date.now();
      const turns = [
        ...history.slice(-8),
        { role: "user",      content: userMessage },
        { role: "assistant", content: finalText },
      ];
      (async () => {
        try {
          const extracted = await extractMemory(turns);
          if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
            await mergeMemory(userId, sessionId, extracted);
            console.log(`[memory:${this.DOMAIN}] saved ${extracted.facts.length} facts + ${extracted.patterns.length} patterns`);
          }
        } catch (err) {
          console.warn(`[memory:${this.DOMAIN}] save failed:`, err instanceof Error ? err.message : err);
        }
      })();

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
