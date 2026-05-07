/**
 * GrowthAgent v4 — multi-agent orchestrator with SupervisorAgent.
 *
 * FLOW PER MESSAGGIO:
 *   1. RouterAgent → { domain, intent, confidence }
 *   2a. confidence >= 0.60 → SpecialistAgent.run() (includes supervisor)
 *   2b. fallback  → original pipeline + supervisor gate
 */
import OpenAI from "openai";
import { openai } from "../client";
import { retrieve } from "./retriever";
import { searchWeb, MIN_LOCAL_CHUNKS } from "./web-search";
import { buildSystemPrompt, type UserContext } from "./prompt-builder";
import { runChainOfThought } from "./chain-of-thought";
import { evaluateSelf, type EvalResult } from "./self-evaluator";
import { routerAgent } from "./router-agent";
import { getSpecialist } from "./specialist-agent";
import { supervisorAgent } from "./supervisor-agent";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { RouteDecision } from "./router-agent";
import type { SupervisorResult } from "./supervisor-agent";

// Register specialists
import "./specialists/career-agent";
import "./specialists/mindset-agent";
import "./specialists/habits-agent";

export const GROWTH_AGENT_MODEL = "gpt-4o";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GrowthAgentOptions {
  userId: number;
  userContext: UserContext & { memorySection?: string };
  history: ChatMessage[];
  userMessage: string;
  maxHistory?: number;
  memoryFactCount?: number;
}

function buildConversationSummary(history: ChatMessage[]): string {
  return history
    .slice(-4)
    .map((m) => `${m.role === "user" ? "Utente" : "Coach"}: ${m.content.slice(0, 200)}`)
    .join("\n");
}

export async function* runGrowthAgent(
  opts: GrowthAgentOptions,
): AsyncGenerator<
  | { type: "token"; value: string }
  | { type: "done"; sources: RetrievedChunk[]; cot?: CoTResult | null; evalResult?: EvalResult; routeDecision?: RouteDecision; supervisorResult?: SupervisorResult }
  | { type: "error"; message: string }
> {
  const { userId, userContext, history, userMessage, maxHistory = 12, memoryFactCount = 0 } = opts;

  // ── 1. Route ───────────────────────────────────────────────────────────────────
  const routeDecision = await routerAgent.route(userMessage, history);
  console.log(`[agent] routed to=${routeDecision.domain} intent=${routeDecision.intent} conf=${routeDecision.confidence.toFixed(2)}`);

  // ── 2a. Specialist path ────────────────────────────────────────────────────
  if (routeDecision.confidence >= 0.60 && routeDecision.domain !== "general") {
    const specialist = getSpecialist(routeDecision.domain);
    if (specialist) {
      yield* specialist.run({ userId, userContext, history, userMessage, routeDecision, memoryFactCount, maxHistory });
      return;
    }
  }

  // ── 2b. General fallback + supervisor ───────────────────────────────────────
  const conversationSummary = buildConversationSummary(history);
  const [personaExamples, documentChunks, cot] = await Promise.all([
    retrieve(userMessage, userId, { topK: 3, minScore: 0.30, sourceTypes: ["persona_example"] }),
    retrieve(userMessage, userId, { topK: 5, minScore: 0.35, sourceTypes: ["document", "user_note"] }),
    runChainOfThought(userMessage, conversationSummary),
  ]);

  let webResults: RetrievedChunk[] = [];
  if (documentChunks.length < MIN_LOCAL_CHUNKS) {
    webResults = await searchWeb(`crescita personale ${userMessage}`, 4);
  }

  const evalResult = evaluateSelf({ userMessage, documentChunks, webResults, cot, memoryFactCount });
  const systemPrompt = buildSystemPrompt({ userContext, personaExamples, documentChunks, webResults, cot, userMessage, evalResult });

  const recentHistory = history.slice(-maxHistory);
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...recentHistory.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const temperature = evalResult.level === "low" ? 0.45 : 0.72;

  try {
    const stream = await openai.chat.completions.create({
      model: GROWTH_AGENT_MODEL,
      messages,
      stream: true,
      temperature,
      max_tokens: evalResult.level === "low" ? 300 : 600,
    });

    // Buffer
    const tokenBuffer: string[] = [];
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) tokenBuffer.push(delta);
    }

    const draft = tokenBuffer.join("");

    // Supervisor
    const supervisorInput = { userMessage, draft, domain: routeDecision.domain, intent: routeDecision.intent };
    let supervisorResult = supervisorAgent.evaluate(supervisorInput);
    let finalText = draft;

    if (!supervisorResult.pass) {
      console.log(`[supervisor] FAIL (score=${supervisorResult.score}) reasons: ${supervisorResult.reasons.join(" | ")}`);
      finalText = await supervisorAgent.rewrite(supervisorInput, supervisorResult);
      supervisorResult = { ...supervisorResult, rewritten: true };
    } else {
      console.log(`[supervisor] PASS (score=${supervisorResult.score})`);
    }

    // Stream final text
    const CHUNK_SIZE = 4;
    for (let i = 0; i < finalText.length; i += CHUNK_SIZE) {
      yield { type: "token", value: finalText.slice(i, i + CHUNK_SIZE) };
    }

    yield {
      type: "done",
      sources: [...personaExamples, ...documentChunks, ...webResults],
      cot,
      evalResult,
      routeDecision,
      supervisorResult,
    };
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
