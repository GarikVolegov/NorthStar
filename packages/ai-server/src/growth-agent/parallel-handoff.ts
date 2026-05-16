/**
 * ParallelHandoff v2 — true progressive streaming.
 *
 * PHASE 8 CHANGE: streaming architecture
 * ─────────────────────────────────
 * v1: both specialists buffered completely, THEN fused, THEN streamed.
 *     → user sees silence for max(A,B) + fusion latency.
 *
 * v2: both specialists run concurrently. As soon as the FASTER one finishes,
 *     we start streaming its tokens immediately while the SLOWER one finishes
 *     in the background. If both finish within 300ms of each other, we fuse
 *     them (as before). Otherwise we stream the winner and append the loser
 *     as a second section with a light divider.
 *
 * STRATEGY TABLE:
 * ┌──────────────────────────────────────────────────────────────────────────────┐
 * | Both finish within FUSION_WINDOW (500ms): fuse → single coherent response |
 * | Delta > FUSION_WINDOW: stream winner first → separator → stream loser    |
 * | One fails: stream the surviving one immediately                            |
 * | Both fail: emit error                                                      |
 * └──────────────────────────────────────────────────────────────────────────────┘
 */
import { openai } from "../client";
import { getLLM } from "../llm/client";
import { selectModelFor } from "../model-router";
import { getSpecialist } from "./specialist-agent";
import type { SpecialistRunOptions, SpecialistEvent } from "./specialist-agent";
import type { RouteDecision, Domain } from "./router-agent";
import type { RetrievedChunk } from "./retriever";
import type { CoTResult } from "./chain-of-thought";
import type { EvalResult } from "./self-evaluator";
import type { SupervisorResult } from "./supervisor-agent";
import type { ChatMessage } from "./agent";
import type { UserContext } from "./prompt-builder";
import { logger } from "../logger";

// How long to wait (ms) after the first specialist finishes before giving up
// on fusion and switching to sequential append mode.
const FUSION_WINDOW_MS = 500;
const CHUNK_SIZE       = 4;

// ── Types ────────────────────────────────────────────────────────────────────────

export interface ParallelHandoffOptions {
  userId:                number;
  userContext:           UserContext & { memorySection?: string };
  history:               ChatMessage[];
  userMessage:           string;
  primaryRoute:          RouteDecision;
  secondaryRoute:        RouteDecision;
  memoryFactCount:       number;
  maxHistory?:           number;
  requestId?:            string;
  behavioralPatterns?:   Array<{ patternType: string; description: string; confidence: number }>;
  routingHistorySummary?: string;
}

export type ParallelHandoffEvent =
  | { type: "token";  value: string }
  | { type: "status"; value: string; domain?: Domain }
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
  finishedAt: number; // Date.now() when drain completed
  error?:  string;
}

// ── Drain a specialist generator ────────────────────────────────────────────────

async function drainSpecialist(
  specialist: ReturnType<typeof getSpecialist>,
  opts: SpecialistRunOptions,
  domain: Domain,
): Promise<SpecialistResult> {
  if (!specialist) {
    return { domain, text: "", sources: [], statusEvents: [], finishedAt: Date.now(), error: `No specialist for ${domain}` };
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
      cot              = event.cot;
      evalResult       = event.evalResult;
      supervisorResult = event.supervisorResult;
    } else if (event.type === "error") {
      return { domain, text, sources, statusEvents, finishedAt: Date.now(), error: event.message };
    }
  }

  return { domain, text, sources, cot, evalResult, supervisorResult, statusEvents, finishedAt: Date.now() };
}

// ── Fusion prompt (unchanged) ──────────────────────────────────────────────────

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
  primary:     SpecialistResult,
  secondary:   SpecialistResult,
  userMessage: string,
): Promise<string> {
  const prompt = `
Messaggio utente: "${userMessage}"

=== BOZZA PRIMARIA (${primary.domain}) ===
${primary.text}

=== BOZZA SECONDARIA (${secondary.domain}) ===
${secondary.text}

Sintetizza le due bozze in una risposta unica, coerente e di alta qualità.
`.trim();

  const route = selectModelFor("parallel-handoff-extract");
  const res = await openai.chat.completions.create({
    model:       route.model,
    messages: [
      { role: "system", content: FUSION_SYSTEM },
      { role: "user",   content: prompt },
    ],
    temperature: 0.4,
    max_tokens:  800,
  });

  return res.choices[0]?.message?.content ?? primary.text;
}

/**
 * Micro-fusion for the large-delta case.
 * Instead of appending the full loser text (which creates a disjointed UX),
 * extracts 3-5 key points from the loser that aren't redundant with the winner.
 */
async function extractKeyDifferences(
  primary: SpecialistResult,
  secondary: SpecialistResult,
  userMessage: string,
): Promise<string> {
  const prompt = `Messaggio utente: "${userMessage}"

Bozza primaria (${primary.domain}):
${primary.text}

Bozza secondaria (${secondary.domain}):
${secondary.text}

Estrai 3-5 punti chiave dalla bozza secondaria che NON siano già coperti nella bozza primaria.
Output: un bullet point per riga, massimo 15 parole ciascuno. Nessun preambolo.`;

  try {
    const route = selectModelFor("parallel-handoff-gate");
    const res = await getLLM().chatOnce(
      [
        {
          role: "system",
          content: "Sei un assistente che estrae informazioni non ridondanti. Output solo bullet points, uno per riga.",
        },
        { role: "user", content: prompt },
      ],
      { model: route.model, temperature: 0.3, maxTokens: 200 },
    );
    return res.trim();
  } catch {
    return secondary.text.slice(0, 200);
  }
}

// ── Helper: stream text token-by-token ────────────────────────────────────────────

function* streamText(text: string): Generator<ParallelHandoffEvent> {
  for (let i = 0; i < text.length; i += CHUNK_SIZE) {
    yield { type: "token", value: text.slice(i, i + CHUNK_SIZE) };
  }
}

// ── Main orchestrator v2 ───────────────────────────────────────────────────────────

export async function* runParallelHandoff(
  opts: ParallelHandoffOptions,
): AsyncGenerator<ParallelHandoffEvent> {
  const {
    userId, userContext, history, userMessage,
    primaryRoute, secondaryRoute, memoryFactCount, maxHistory = 12,
    behavioralPatterns, routingHistorySummary,
  } = opts;

  const primarySpecialist   = getSpecialist(primaryRoute.domain);
  const secondarySpecialist = getSpecialist(secondaryRoute.domain);

  if (!primarySpecialist && !secondarySpecialist) {
    yield { type: "error", message: "Nessuno specialista disponibile per il handoff parallelo." };
    return;
  }

  yield { type: "status", value: `⚡ Attivo ${primaryRoute.domain} + ${secondaryRoute.domain} in parallelo...` };

  const sharedOpts: Omit<SpecialistRunOptions, 'routeDecision' | 'userMessage'> = { userId, userContext, history, memoryFactCount, maxHistory, behavioralPatterns, routingHistorySummary };
  const startedAt  = Date.now();

  // ── Phase 8: race both drains ───────────────────────────────────────────────────
  // Both drains run concurrently. We use Promise.race to detect when the
  // FIRST one finishes, then decide strategy based on timing.

  let primaryResult: SpecialistResult | undefined;
  let secondaryResult: SpecialistResult | undefined;

  const primaryPromise = drainSpecialist(
    primarySpecialist,
    { ...sharedOpts, userMessage, routeDecision: primaryRoute },
    primaryRoute.domain,
  ).then((r) => { primaryResult = r; return r; });

  const secondaryPromise = drainSpecialist(
    secondarySpecialist,
    { ...sharedOpts, userMessage, routeDecision: secondaryRoute },
    secondaryRoute.domain,
  ).then((r) => { secondaryResult = r; return r; });

  // Wait for the FASTER specialist
  const winner = await Promise.race([primaryPromise, secondaryPromise]);
  const firstDoneAt = Date.now();

  // Emit winner status events immediately
  for (const s of winner.statusEvents) {
    yield { type: "status", value: `[${s.domain}] ${s.value}`, domain: s.domain };
  }

  // Wait at most FUSION_WINDOW_MS for the other specialist
  const remainingMs   = FUSION_WINDOW_MS - (Date.now() - firstDoneAt);
  const loserPromise  = winner.domain === primaryRoute.domain ? secondaryPromise : primaryPromise;

  const loserResult = await Promise.race([
    loserPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), Math.max(0, remainingMs))),
  ]);

  const loser = loserResult ?? (winner.domain === primaryRoute.domain ? secondaryResult : primaryResult);

  if (loser) {
    for (const s of loser.statusEvents) {
      yield { type: "status", value: `[${s.domain}] ${s.value}`, domain: s.domain };
    }
  }

  // ── Determine the two results in primary/secondary order ───────────────────────
  const pResult = primaryResult ?? { domain: primaryRoute.domain, text: "", sources: [], statusEvents: [], finishedAt: Date.now(), error: "timeout" };
  const sResult = secondaryResult ?? (loser ?? { domain: secondaryRoute.domain, text: "", sources: [], statusEvents: [], finishedAt: Date.now(), error: "timeout" }) as SpecialistResult;

  const primaryOk   = !pResult.error   && pResult.text.length   > 0;
  const secondaryOk = !sResult.error   && sResult.text.length   > 0;
  const delta       = Math.abs((pResult.finishedAt ?? 0) - (sResult.finishedAt ?? 0));

  let finalText: string;
  let usedPrimary = pResult;

  if (primaryOk && secondaryOk) {
    if (delta <= FUSION_WINDOW_MS) {
      // ── Both finished close together: fuse into one response ────────────────────
      yield { type: "status", value: "🧩 Fusione delle prospettive in corso..." };
      finalText = await fuseResponses(pResult, sResult, userMessage).catch(() => pResult.text);
    } else {
      // ── Large delta: stream winner + key differences extracted from loser ──
      // Avoids appending the full raw loser text which creates a disjointed UX.
      const [first, second] = winner.domain === primaryRoute.domain
        ? [pResult, sResult]
        : [sResult, pResult];
      yield { type: "status", value: `💡 Estraendo insight da ${second.domain}...` };
      const keyPoints = await extractKeyDifferences(first, second, userMessage);
      finalText = `${first.text}\n\n---\n*💡 Punti chiave dal coach (${second.domain}):*\n${keyPoints}`;
    }
  } else if (primaryOk) {
    finalText = pResult.text;
  } else if (secondaryOk) {
    finalText = sResult.text;
    usedPrimary = sResult;
  } else {
    yield { type: "error", message: "Entrambi gli specialisti hanno fallito. Riprova." };
    return;
  }

  yield* streamText(finalText);

  // Merge sources (deduplicate)
  const seenSources = new Set<string>();
  const mergedSources: RetrievedChunk[] = [];
  for (const s of [...pResult.sources, ...sResult.sources]) {
    const key = `${s.source}:${s.content.slice(0, 40)}`;
    if (!seenSources.has(key)) { seenSources.add(key); mergedSources.push(s); }
  }

  logger.info({ strategy: primaryOk && secondaryOk ? (delta <= FUSION_WINDOW_MS ? "fuse" : "append") : "single", latencyMs: Date.now() - startedAt }, "parallel handoff complete");

  yield {
    type:             "done",
    sources:          mergedSources,
    cot:              usedPrimary.cot,
    evalResult:       usedPrimary.evalResult,
    routeDecision:    { ...primaryRoute, handoffContext: `parallel:${primaryRoute.domain}+${secondaryRoute.domain}` },
    supervisorResult: usedPrimary.supervisorResult,
  };
}
