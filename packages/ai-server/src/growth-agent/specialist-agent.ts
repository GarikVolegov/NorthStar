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
import { getLLMForRoute, type LLMMessage } from "../llm/client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { runChainOfThought } from "./chain-of-thought";
import { evaluateSelf } from "./self-evaluator";
import { buildSystemPrompt, type UserContext } from "./prompt-builder";
import { supervisorAgent } from "./supervisor-agent";
import type { SupervisorResult } from "./supervisor-agent";
import type { ChatMessage } from "./agent";
import { logger } from "../logger";
import { loadMemory, buildMemorySection, extractMemory, mergeMemory } from "./memory-manager";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { EvalResult } from "./self-evaluator";
import type { Domain, RouteDecision } from "./router-agent";
import { selectModelFor, modelFor } from "../model-router";
import { wendyConfig } from "../config/wendy";

/**
 * @deprecated reflects the *baseline* (non-premium) model. The actual model is
 * resolved per-request inside `run()` via `selectModelFor("specialist-chat", { isPremium })`.
 */
export const SPECIALIST_MODEL = modelFor("specialist-chat");

// Domain-specific status icon for the first status message
const DOMAIN_STATUS_ICONS: Record<Domain, string> = {
  career:  "💼",
  mindset: "🧠",
  habits:  "🌱",
  trading: "📈",
  finance: "💰",
  relationships: "🤝",
  health: "🏥",
  general: "✨",
};

const DOMAIN_LABELS: Record<Domain, string> = {
  career:  "profilo carriera",
  mindset: "profilo mindset",
  habits:  "profilo abitudini",
  trading: "profilo trading",
  finance: "profilo finanziario",
  relationships: "profilo relazionale",
  health: "profilo benessere",
  general: "profilo",
};

export interface SpecialistRunOptions {
  userId:                number;
  sessionId?:            number | undefined;
  userContext:           UserContext & { memorySection?: string | undefined };
  history:               ChatMessage[];
  userMessage:           string;
  normalizedMessage?:    string | undefined;
  routeDecision:         RouteDecision;
  memoryFactCount?:      number | undefined;
  maxHistory?:           number | undefined;
  requestId?:            string | undefined;
  behavioralPatterns?:   Array<{ patternType: string; description: string; confidence: number }> | undefined;
  routingHistorySummary?: string | undefined;
}

export type SpecialistEvent =
  | { type: "token";  value: string }
  | { type: "status"; value: string }           // ← NEW v4
  | { type: "done";   sources: RetrievedChunk[]; cot?: CoTResult | null | undefined; evalResult?: EvalResult | undefined; routeDecision: RouteDecision; supervisorResult?: SupervisorResult | undefined }
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
    const analysisMessage = opts.normalizedMessage ?? userMessage;

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
        logger.warn({ err, domain: this.DOMAIN }, "specialist memory load failed");
      }
    }

    const { cotHistorySlice, cotMessageTruncate } = wendyConfig.specialist;
    const conversationSummary = history
      .slice(-cotHistorySlice)
      .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, cotMessageTruncate)}`)
      .join("\n");

    // ── 1. RAG ────────────────────────────────────────────────────────────────
    yield { type: "status", value: "🔍 Cerco nella knowledge base..." };

    const sc = wendyConfig.specialist;
    const [personaExamples, documentChunks, cot] = await Promise.all([
      retrieve(analysisMessage, userId, { topK: 3, minScore: sc.personaMinScore, sourceTypes: ["persona_example"] }).catch((err) => {
        logger.warn({ err, domain: this.DOMAIN }, "specialist persona retrieval failed");
        return [] as RetrievedChunk[];
      }),
      retrieve(analysisMessage, userId, { topK: sc.documentTopK, minScore: sc.documentMinScore, sourceTypes: ["document", "user_note"] }).catch((err) => {
        logger.warn({ err, domain: this.DOMAIN }, "specialist document retrieval failed");
        return [] as RetrievedChunk[];
      }),
      runChainOfThought(userId, analysisMessage, conversationSummary, opts.sessionId),
    ]);

    // ── 2. Web fallback ───────────────────────────────────────────────────────
    let webResults: RetrievedChunk[] = [];
    if (documentChunks.length < MIN_LOCAL_CHUNKS) {
      yield { type: "status", value: "🌐 Cerco fonti aggiornate sul web..." };
      webResults = await searchWeb(this.domainWebQuery(analysisMessage), 4);
    }

    // ── 3. Self-eval + CoT result ───────────────────────────────────────────────
    yield { type: "status", value: "🧠 Analizzando la situazione..." };

    const evalResult = evaluateSelf({ userMessage: analysisMessage, documentChunks, webResults, cot, memoryFactCount });

    // ── 4. System prompt ──────────────────────────────────────────────────────
    const domainSection = this.buildDomainSection(analysisMessage, cot, routeDecision);
    const domainHeader  = [
      `## Specialista: ${this.DOMAIN.toUpperCase()}`,
      `**Persona**: ${this.PERSONA_CORE}`,
      `**Tono**: ${this.TONE_HINT}`,
      `**Intento rilevato**: ${routeDecision.intent} (confidence: ${routeDecision.confidence.toFixed(2)})`,
      `**Contesto handoff**: ${routeDecision.handoffContext}`,
      domainSection,
    ].filter(Boolean).join("\n");

    // Add behavioral patterns to domain header
    const bp = opts.behavioralPatterns;
    let patternsLine = "";
    if (bp && bp.length > 0) {
      patternsLine = "\n**Pattern comportamentali**: " +
        bp.slice(0, 3).map((p) => `${p.description} (${(p.confidence * 100).toFixed(0)}%)`).join("; ");
    }
    if (opts.routingHistorySummary) {
      patternsLine += "\n**Routing recente**: " + opts.routingHistorySummary;
    }
    const domainHeaderWithPatterns = patternsLine
      ? domainHeader + "\n" + patternsLine
      : domainHeader;

    const combinedMemory = [resolvedMemorySection, domainHeaderWithPatterns].filter(Boolean).join("\n\n");
    const enrichedContext: UserContext & { memorySection?: string } = {
      ...userContext,
      memorySection: combinedMemory,
    };

    const systemPrompt = buildSystemPrompt({
      userContext: enrichedContext, personaExamples, documentChunks,
      webResults, cot, userMessage: analysisMessage, evalResult,
    });

    // ── 5. Stream + BUFFER ────────────────────────────────────────────────────
    const recentHistory = history.slice(-maxHistory);
    const messages: LLMMessage[] = [
      { role: "system",    content: systemPrompt },
      ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user",      content: userMessage },
    ];

    const temperature = evalResult.level === "low" ? sc.temperatureLow : sc.temperatureHigh;

    try {
      yield { type: "status", value: "✨ Sto scrivendo la risposta..." };

      const route = selectModelFor("specialist-chat", {
        isPremium: !!(enrichedContext as { isPremium?: boolean }).isPremium,
        complexity: evalResult.level === "high" ? "deep" : "standard",
      });

      const llm = getLLMForRoute({ provider: route.provider });
      const draft = await llm.chatOnce(messages, {
        model: route.model,
        temperature,
        maxTokens: evalResult.level === "low" ? sc.maxTokensLow : sc.maxTokensHigh,
      });

      // ── 6. Supervisor gate ──────────────────────────────────────────────────
      const supervisorInput = { userMessage: analysisMessage, draft, domain: routeDecision.domain, intent: routeDecision.intent };
      let supervisorResult  = await supervisorAgent.evaluate(supervisorInput);
      let finalText         = draft;

      if (!supervisorResult.pass) {
        yield { type: "status", value: "🔄 Revisione qualità in corso..." };
        logger.info({ domain: this.DOMAIN, supervisorScore: supervisorResult.score }, "specialist supervisor FAIL");
        finalText        = await supervisorAgent.rewrite(supervisorInput, supervisorResult);
        supervisorResult = { ...supervisorResult, rewritten: true };
      } else {
        logger.info({ domain: this.DOMAIN, supervisorScore: supervisorResult.score }, "specialist supervisor PASS");
      }

      // ── 7. Stream final text ────────────────────────────────────────────────
      const CHUNK_SIZE = wendyConfig.agent.chunkSize;
      for (let i = 0; i < finalText.length; i += CHUNK_SIZE) {
        yield { type: "token", value: finalText.slice(i, i + CHUNK_SIZE) };
      }

      yield {
        type: "done", sources: [...personaExamples, ...documentChunks, ...webResults],
        cot, evalResult, routeDecision, supervisorResult,
      };

      // ── 8. Fire-and-forget memory save (with timeout) ─────────────────────────
      const sessionId = Date.now();
      const turns = [
        ...history.slice(-8),
        { role: "user",      content: userMessage },
        { role: "assistant", content: finalText },
      ];
      (async () => {
        const timeout = new Promise<void>((_, rej) =>
          setTimeout(() => rej(new Error("timeout")), 8000),
        );
        try {
          await Promise.race([
            (async () => {
              const extracted = await extractMemory(turns);
              if (extracted && (extracted.facts.length > 0 || extracted.patterns.length > 0)) {
                await mergeMemory(userId, sessionId, extracted);
                logger.info({ domain: this.DOMAIN, facts: extracted.facts.length, patterns: extracted.patterns.length }, "specialist memory saved");
              }
            })(),
            timeout,
          ]);
        } catch (err) {
          logger.warn({ err, domain: this.DOMAIN }, "specialist memory save failed/timeout");
        }
      })();

    } catch (err) {
      yield { type: "error", message: err instanceof Error ? err.message : String(err) };
    }
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Registry centrale degli SpecialistAgent.
 *
 * @pattern Factory + Registry
 * - I singoli specialist (career, mindset, habits, trading, health) si registrano
 *   tramite `registerSpecialist()` al boot del processo.
 * - `getSpecialist(domain)` agisce come Factory che restituisce l'istanza corretta
 *   in base al dominio richiesto dal router.
 */
const registry = new Map<Domain, SpecialistAgent>();

/**
 * Registra uno SpecialistAgent nel registry globale.
 * @pattern Factory registration
 */
export function registerSpecialist(agent: SpecialistAgent): void {
  registry.set(agent.DOMAIN, agent);
  logger.info({ domain: agent.DOMAIN }, "specialist registered");
}

/**
 * Recupera lo SpecialistAgent registrato per il dominio dato.
 * @pattern Factory lookup
 */
export function getSpecialist(domain: Domain): SpecialistAgent | null {
  return registry.get(domain) ?? null;
}
