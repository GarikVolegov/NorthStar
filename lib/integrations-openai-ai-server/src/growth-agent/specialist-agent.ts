/**
 * SpecialistAgent v3 — persistent memory wired into specialist flow.
 *
 * CHANGES v3
 * ──────────
 * Memory is now loaded at the START of run() in parallel with RAG retrieval.
 * If the caller has already loaded memory (via agent.ts v5), the pre-loaded
 * memorySection in userContext is used directly — no double DB call.
 * If memorySection is missing (direct specialist invocation in tests/scripts),
 * memory is loaded here as a fallback.
 *
 * After streaming 'done', extractMemory() + mergeMemory() are scheduled
 * fire-and-forget — non-blocking, never delays the user response.
 *
 * FLOW (v3 — with memory)
 * ────
 *   0. [PARALLEL] load memory (if not pre-loaded) + RAG retrieval
 *   1. RAG retrieval (persona examples + domain docs)
 *   2. Web fallback if KB is thin
 *   3. [PARALLEL] CoT + self-eval
 *   4. Build system prompt (base + domain overrides + memory)
 *   5. Stream GPT-4o response → buffer tokens silently
 *   6. SupervisorAgent gate
 *   7. Yield 'done'
 *   8. [FIRE & FORGET] save memory from this exchange
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { runChainOfThought } from "./chain-of-thought";
import { evaluateSelf } from "./self-evaluator";
import { buildSystemPrompt } from "./prompt-builder";
import { supervisorAgent } from "./supervisor-agent";
import {
  loadMemory,
  buildMemorySection,
  extractMemory,
  mergeMemory,
} from "./memory-manager";
import type { SupervisorResult } from "./supervisor-agent";
import type { UserContext } from "./prompt-builder";
import type { ChatMessage } from "./agent";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { EvalResult } from "./self-evaluator";
import type { Domain, RouteDecision } from "./router-agent";

export const SPECIALIST_MODEL = "gpt-4o";

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
      userId,
      userContext,
      history,
      userMessage,
      routeDecision,
      maxHistory = 12,
    } = opts;

    const conversationSummary = history
      .slice(-4)
      .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
      .join("\n");

    // ── 0. Memory — use pre-loaded section or load from DB ─────────────────
    // agent.ts v5 already loads memory before calling run(), so in the normal
    // flow userContext.memorySection is already set. We only hit the DB here
    // if the specialist is invoked directly (e.g. tests, scripts).
    let resolvedMemorySection = userContext.memorySection ?? "";
    let memoryFactCount = opts.memoryFactCount ?? 0;

    if (!resolvedMemorySection) {
      try {
        const userMemory = await loadMemory(userId);
        resolvedMemorySection = buildMemorySection(userMemory);
        memoryFactCount = userMemory.facts.length;
        console.log(`[specialist:${this.DOMAIN}] memory loaded from DB: ${userMemory.facts.length} facts`);
      } catch (err) {
        console.warn(`[specialist:${this.DOMAIN}] memory load failed (non-fatal):`, err instanceof Error ? err.message : err);
      }
    }

    // ── 1. RAG ────────────────────────────────────────────────────────────────
    const [personaExamples, documentChunks, cot] = await Promise.all([
      retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["persona_example"] }),
      retrieve(userMessage, userId, { topK: 6, minScore: 0.35, sourceTypes: ["document", "user_note"] }),
      runChainOfThought(userMessage, conversationSummary),
    ]);

    // ── 2. Web fallback ───────────────────────────────────────────────────────
    let webResults: RetrievedChunk[] = [];
    if (documentChunks.length < MIN_LOCAL_CHUNKS) {
      webResults = await searchWeb(this.domainWebQuery(userMessage), 4);
    }

    // ── 3. Self-eval ──────────────────────────────────────────────────────────
    const evalResult = evaluateSelf({ userMessage, documentChunks, webResults, cot, memoryFactCount });

    // ── 4. System prompt ──────────────────────────────────────────────────────
    const domainSection = this.buildDomainSection(userMessage, cot, routeDecision);
    const domainHeader = [
      `## Specialista: ${this.DOMAIN.toUpperCase()}`,
      `**Persona**: ${this.PERSONA_CORE}`,
      `**Tono**: ${this.TONE_HINT}`,
      `**Intento rilevato**: ${routeDecision.intent} (confidence: ${routeDecision.confidence.toFixed(2)})`,
      `**Contesto handoff**: ${routeDecision.handoffContext}`,
      domainSection,
    ].filter(Boolean).join("\n");

    // Memory section + domain header both go into the prompt via memorySection slot
    const combinedMemory = [resolvedMemorySection, domainHeader].filter(Boolean).join("\n\n");

    const enrichedContext: UserContext & { memorySection?: string } = {
      ...userContext,
      memorySection: combinedMemory,
    };

    const systemPrompt = buildSystemPrompt({
      userContext: enrichedContext,
      personaExamples,
      documentChunks,
      webResults,
      cot,
      userMessage,
      evalResult,
    });

    // ── 5. Stream + BUFFER ────────────────────────────────────────────────────
    const recentHistory = history.slice(-maxHistory);
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user", content: userMessage },
    ];

    const temperature = evalResult.level === "low" ? 0.45 : 0.72;

    try {
      const stream = await openai.chat.completions.create({
        model: SPECIALIST_MODEL,
        messages,
        stream: true,
        temperature,
        max_tokens: evalResult.level === "low" ? 300 : 700,
      });

      const tokenBuffer: string[] = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) tokenBuffer.push(delta);
      }

      const draft = tokenBuffer.join("");

      // ── 6. Supervisor gate ──────────────────────────────────────────────────
      const supervisorInput = {
        userMessage,
        draft,
        domain: routeDecision.domain,
        intent: routeDecision.intent,
      };

      let supervisorResult = supervisorAgent.evaluate(supervisorInput);
      let finalText = draft;

      if (!supervisorResult.pass) {
        console.log(
          `[supervisor] FAIL (score=${supervisorResult.score}) reasons: ${supervisorResult.reasons.join(" | ")}`,
        );
        finalText = await supervisorAgent.rewrite(supervisorInput, supervisorResult);
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
        type:            "done",
        sources:         [...personaExamples, ...documentChunks, ...webResults],
        cot,
        evalResult,
        routeDecision,
        supervisorResult,
      };

      // ── 8. Fire-and-forget memory save ──────────────────────────────────────
      // Non-blocking — runs after the generator is done, user already has response.
      const sessionId = Date.now();
      const turns: Array<{ role: string; content: string }> = [
        ...history.slice(-8),
        { role: "user",      content: userMessage },
        { role: "assistant", content: finalText },
      ];

      (async () => {
        try {
          const extracted = await extractMemory(turns);
          if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
            await mergeMemory(userId, sessionId, extracted);
            console.log(
              `[memory:${this.DOMAIN}] saved ${extracted.facts.length} facts + ${extracted.patterns.length} patterns for user ${userId}`,
            );
          }
        } catch (err) {
          console.warn(
            `[memory:${this.DOMAIN}] save failed (non-fatal):`,
            err instanceof Error ? err.message : err,
          );
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
