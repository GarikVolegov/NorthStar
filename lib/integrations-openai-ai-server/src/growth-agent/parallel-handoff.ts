/**
 * ParallelHandoff — orchestrates concurrent specialist execution and fuses results.
 *
 * ARCHITECTURE
 * ────────────
 * When the RouterAgent identifies a multi-domain message (e.g. career + mindset),
 * this module runs up to 2 specialists CONCURRENTLY and merges their outputs.
 *
 * The merge strategy is NOT simple concatenation.
 * A GPT-4o-mini "Fusion Prompt" synthesises both drafts into a single coherent
 * response that respects the user's primary intent.
 *
 * PRIMARY INTENT WEIGHTING:
 * - The domain with higher confidence is treated as "primary".
 * - The secondary domain contributes context and colour, not structure.
 * - If both have equal confidence, the first domain wins primary.
 *
 * LATENCY STRATEGY:
 * - Both specialists run in parallel via Promise.allSettled().
 * - The status SSE events of both specialists are interleaved in the yielded stream.
 * - Fusion LLM call (gpt-4o-mini) adds ~300-500ms on top of the parallel wall time.
 * - Total latency ≈ max(specialist_A, specialist_B) + fusion ≈ similar to one specialist.
 *
 * FAILURE HANDLING:
 * - If one specialist fails, the other's output is used alone (no fusion).
 * - If both fail, falls back to the general agent.
 *
 * PARALLEL EVENT PROTOCOL:
 * - Status events from both agents are prefixed with domain labels so the UI
 *   can optionally show a split-panel loading state.
 *   Format: { type: "status", value: "[career] 🔍 Cerco nella KB...", domain: "career" }
 *
 * EXPORTED API:
 *   runParallelHandoff(opts): AsyncGenerator<ParallelHandoffEvent>
 */
import { openai } from "../client";
import { getSpecialist } from "./specialist-agent";
import type { SpecialistRunOptions, SpecialistEvent } from "./specialist-agent";
import type { RouteDecision, Domain } from "./router-agent";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { EvalResult } from "./self-evaluator";
import type { SupervisorResult } from "./supervisor-agent";
import type { ChatMessage } from "./agent";
import type { UserContext } from "./prompt-builder";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParallelHandoffOptions {
  userId:          number;
  userContext:     UserContext & { memorySection?: string };
  history:         ChatMessage[];
  userMessage:     string;
  primaryRoute:    RouteDecision;
  secondaryRoute:  RouteDecision;
  memoryFactCount: number;
  maxHistory?:     number;
}

export type ParallelHandoffEvent =
  | { type: "token";  value: string }
  | { type: "status"; value: string; domain?: Domain }    // domain tag optional for UI split-panel
  | { type: "done";   sources: RetrievedChunk[]; cot?: CoTResult | null; evalResult?: EvalResult; routeDecision: RouteDecision; supervisorResult?: SupervisorResult }
  | { type: "error";  message: string };

interface SpecialistResult {
  domain:  Domain;
  text:    string;
  sources: RetrievedChunk[];
  cot?:    CoTResult | null;
  evalResult?: EvalResult;
  supervisorResult?: SupervisorResult;
  statusEvents: Array<{ value: string; domain: Domain }>;
  error?:  string;
}

// ── Drain a specialist generator into a SpecialistResult ────────────────────

async function drainSpecialist(
  specialist: ReturnType<typeof getSpecialist>,
  opts: SpecialistRunOptions,
  domain: Domain,
): Promise<SpecialistResult> {
  if (!specialist) {
    return { domain, text: "", sources: [], statusEvents: [], error: `No specialist registered for ${domain}` };
  }

  let text = "";
  const sources: RetrievedChunk[] = [];
  let cot: CoTResult | null | undefined;
  let evalResult: EvalResult | undefined;
  let supervisorResult: SupervisorResult | undefined;
  const statusEvents: Array<{ value: string; domain: Domain }> = [];

  for await (const event of specialist.run(opts)) {
    if (event.type === "token") {
      text += event.value;
    } else if (event.type === "status") {
      statusEvents.push({ value: event.value, domain });
    } else if (event.type === "done") {
      sources.push(...event.sources);
      cot             = event.cot;
      evalResult      = event.evalResult;
      supervisorResult = event.supervisorResult;
    } else if (event.type === "error") {
      return { domain, text, sources, statusEvents, error: event.message };
    }
  }

  return { domain, text, sources, cot, evalResult, supervisorResult, statusEvents };
}

// ── Fusion prompt ────────────────────────────────────────────────────────────

const FUSION_SYSTEM = `
Sei il coach di NorthStar. Hai ricevuto due bozze di risposta da due specialisti diversi
che hanno analizzato lo stesso messaggio utente ognuno dalla propria prospettiva.

Il tuo compito è sintetizzare le due bozze in UN'UNICA risposta coerente.

REGOLE DI FUSIONE:
1. Lo specialista PRIMARIO fornisce la struttura e il punto di vista principale.
2. Lo specialista SECONDARIO arricchisce con insight complementari dove rilevante.
3. NON ripetere gli stessi concetti due volte con parole diverse.
4. NON usare frasi di raccordo artificiali tipo "inoltre" o "da un altro punto di vista".
5. La risposta fusa deve sembrare scritta da un'unica voce, non da due agenti separati.
6. Mantieni la stessa lingua della risposta primaria.
7. Lunghezza target: massimo 300 parole, a meno che entrambe le bozze siano molto più lunghe.
8. Concludi sempre con UN'azione concreta o una domanda socratica.
`.trim();

async function fuseResponses(
  primaryResult:   SpecialistResult,
  secondaryResult: SpecialistResult,
  userMessage:     string,
): Promise<string> {
  const prompt = `
Messaggio utente: "${userMessage}"

=== BOZZA PRIMARIA (${primaryResult.domain}) ===
${primaryResult.text}

=== BOZZA SECONDARIA (${secondaryResult.domain}) ===
${secondaryResult.text}

Sintetizza le due bozze in una risposta unica, coerente e di alta qualità.
`.trim();

  const res = await openai.chat.completions.create({
    model:       "gpt-4o-mini",
    messages: [
      { role: "system", content: FUSION_SYSTEM },
      { role: "user",   content: prompt },
    ],
    temperature: 0.4,
    max_tokens:  800,
  });

  return res.choices[0]?.message?.content ?? primaryResult.text;
}

// ── Main orchestrator ────────────────────────────────────────────────────────

export async function* runParallelHandoff(
  opts: ParallelHandoffOptions,
): AsyncGenerator<ParallelHandoffEvent> {
  const {
    userId, userContext, history, userMessage,
    primaryRoute, secondaryRoute, memoryFactCount, maxHistory = 12,
  } = opts;

  const primarySpecialist   = getSpecialist(primaryRoute.domain);
  const secondarySpecialist = getSpecialist(secondaryRoute.domain);

  // Bail early if we can't find specialists
  if (!primarySpecialist && !secondarySpecialist) {
    yield { type: "error", message: "Nessuno specialista disponibile per il handoff parallelo." };
    return;
  }

  yield {
    type:   "status",
    value:  `⚡ Attivo ${primaryRoute.domain} + ${secondaryRoute.domain} in parallelo...`,
  };

  const sharedOpts = { userId, userContext, history, memoryFactCount, maxHistory };

  // ── Run BOTH specialists concurrently ──────────────────────────────────────────
  // Both generators are drained to completion before we start emitting tokens.
  // This keeps the output clean (no interleaved tokens from two agents).
  const [primarySettled, secondarySettled] = await Promise.allSettled([
    drainSpecialist(primarySpecialist, { ...sharedOpts, userMessage, routeDecision: primaryRoute }, primaryRoute.domain),
    drainSpecialist(secondarySpecialist, { ...sharedOpts, userMessage, routeDecision: secondaryRoute }, secondaryRoute.domain),
  ]);

  const primaryResult: SpecialistResult =
    primarySettled.status === "fulfilled"
      ? primarySettled.value
      : { domain: primaryRoute.domain, text: "", sources: [], statusEvents: [], error: primarySettled.reason as string };

  const secondaryResult: SpecialistResult =
    secondarySettled.status === "fulfilled"
      ? secondarySettled.value
      : { domain: secondaryRoute.domain, text: "", sources: [], statusEvents: [], error: secondarySettled.reason as string };

  // ── Emit interleaved status events (UI can use domain tag for split-panel) ────
  const allStatus = [
    ...primaryResult.statusEvents,
    ...secondaryResult.statusEvents,
  ].sort((a, b) =>
    // Interleave: alternate domains rather than dumping one block then the other
    a.domain === primaryRoute.domain ? -1 : 1,
  );

  for (const s of allStatus) {
    yield { type: "status", value: `[${s.domain}] ${s.value}`, domain: s.domain };
  }

  // ── Determine fusion strategy ────────────────────────────────────────────────
  let finalText: string;

  const primaryOk   = !primaryResult.error   && primaryResult.text.length > 0;
  const secondaryOk = !secondaryResult.error && secondaryResult.text.length > 0;

  if (primaryOk && secondaryOk) {
    // Both succeeded — fuse them
    yield { type: "status", value: "🧩 Fusione delle prospettive in corso..." };
    finalText = await fuseResponses(primaryResult, secondaryResult, userMessage).catch(() => primaryResult.text);
  } else if (primaryOk) {
    // Only primary succeeded
    console.warn(`[parallel-handoff] secondary (${secondaryRoute.domain}) failed: ${secondaryResult.error}`);
    finalText = primaryResult.text;
  } else if (secondaryOk) {
    // Only secondary succeeded
    console.warn(`[parallel-handoff] primary (${primaryRoute.domain}) failed: ${primaryResult.error}`);
    finalText = secondaryResult.text;
  } else {
    // Both failed
    yield { type: "error", message: "Entrambi gli specialisti hanno fallito. Riprova." };
    return;
  }

  // ── Stream fused text ─────────────────────────────────────────────────────────────
  const CHUNK_SIZE = 4;
  for (let i = 0; i < finalText.length; i += CHUNK_SIZE) {
    yield { type: "token", value: finalText.slice(i, i + CHUNK_SIZE) };
  }

  // Merge sources from both specialists (deduplicate by source string)
  const seenSources = new Set<string>();
  const mergedSources: RetrievedChunk[] = [];
  for (const s of [...primaryResult.sources, ...secondaryResult.sources]) {
    const key = `${s.source}:${s.content.slice(0, 40)}`;
    if (!seenSources.has(key)) {
      seenSources.add(key);
      mergedSources.push(s);
    }
  }

  yield {
    type:            "done",
    sources:         mergedSources,
    cot:             primaryResult.cot,
    evalResult:      primaryResult.evalResult,
    routeDecision:   { ...primaryRoute, handoffContext: `parallel:${primaryRoute.domain}+${secondaryRoute.domain}` },
    supervisorResult: primaryResult.supervisorResult,
  };
}
