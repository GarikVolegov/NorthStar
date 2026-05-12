/**
 * prompt-builder v2 — platform content section.
 *
 * CHANGES:
 * - buildSystemPrompt() accepts optional platformChunks.
 *   If present and non-empty, injects a dedicated '## Contenuti NorthStar'
 *   section BEFORE the RAG documents section.
 *   This makes platform content authoritative and easily distinguishable
 *   from user documents and web results in the model's context.
 */
import type { RetrievedChunk } from "./retriever";
import type { CoTResult }      from "./chain-of-thought";
import type { EvalResult }     from "./self-evaluator";

export interface UserContext {
  name?:         string;
  journeyType?:  string;
  userMode?:     string;
  objectives?:   string[];
  sectorName?:   string;
  pageContext?:  Record<string, unknown>;
  memorySection?: string;
}

export interface BuildSystemPromptOptions {
  userContext:      UserContext & { memorySection?: string };
  personaExamples:  RetrievedChunk[];
  documentChunks:   RetrievedChunk[];
  webResults:       RetrievedChunk[];
  cot:              CoTResult | null;
  userMessage:      string;
  evalResult:       EvalResult;
  platformChunks?:  RetrievedChunk[]; // ← v2: optional platform content
}

const BASE_SYSTEM = `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi sempre in italiano.
Usa un tono caldo ma concreto — mai vago o generico.
Se non sei sicura, dillo esplicitamente piuttosto che inventare.`;

export function buildSystemPrompt(opts: BuildSystemPromptOptions): string {
  const {
    userContext, personaExamples, documentChunks, webResults,
    cot, userMessage, evalResult, platformChunks = [],
  } = opts;

  const sections: string[] = [BASE_SYSTEM];

  // ── User context ────────────────────────────────────────────────────────
  if (userContext.name || userContext.journeyType || userContext.userMode) {
    const ctx: string[] = [];
    if (userContext.name)        ctx.push(`Nome: ${userContext.name}`);
    if (userContext.journeyType) ctx.push(`Percorso: ${userContext.journeyType}`);
    if (userContext.userMode)    ctx.push(`Modalità: ${userContext.userMode}`);
    if (userContext.objectives?.length) ctx.push(`Obiettivi: ${userContext.objectives.join(", ")}`);
    if (userContext.sectorName)  ctx.push(`Settore: ${userContext.sectorName}`);
    sections.push(`## Profilo utente\n${ctx.join("\n")}`);
  }

  // ── Page context (Wendy copilot) ─────────────────────────────────────────
  if (userContext.pageContext && Object.keys(userContext.pageContext).length > 0) {
    sections.push(
      `## Contesto pagina corrente\n` +
      JSON.stringify(userContext.pageContext, null, 2)
    );
  }

  // ── Memory ───────────────────────────────────────────────────────────────
  if (userContext.memorySection) {
    sections.push(userContext.memorySection);
  }

  // ── Platform content (authoritative NorthStar content) — v2 ─────────────
  if (platformChunks.length > 0) {
    const platformText = platformChunks
      .map((c, i) => `[PIATTAFORMA ${i + 1}] (${c.source})\n${c.content}`)
      .join("\n\n");
    sections.push(`## Contenuti NorthStar (usa questi come riferimento autorevole)\n${platformText}`);
  }

  // ── Persona examples ─────────────────────────────────────────────────────
  if (personaExamples.length > 0) {
    const examples = personaExamples
      .map((c, i) => `[ESEMPIO ${i + 1}]\n${c.content}`)
      .join("\n\n");
    sections.push(`## Esempi di coaching\n${examples}`);
  }

  // ── User documents ────────────────────────────────────────────────────────
  if (documentChunks.length > 0) {
    const docs = documentChunks
      .map((c, i) => `[DOC ${i + 1}] (score: ${c.score.toFixed(2)}, fonte: ${c.source})\n${c.content}`)
      .join("\n\n");
    sections.push(`## Documenti rilevanti dell'utente\n${docs}`);
  }

  // ── Web results ───────────────────────────────────────────────────────────
  if (webResults.length > 0) {
    const web = webResults
      .map((c, i) => `[WEB ${i + 1}] (${c.source})\n${c.content}`)
      .join("\n\n");
    sections.push(`## Risultati web\n${web}`);
  }

  // ── Chain of Thought ──────────────────────────────────────────────────────
  if (cot) {
    const actions = cot.controllableActions
      .map((a, i) => `   ${i + 1}. ${a}`)
      .join("\n");
    sections.push(
      `## Ragionamento preliminare\n` +
      `Pattern rilevato: ${cot.limitingPattern}\n` +
      `Angolo cieco: ${cot.blindSpot}\n` +
      `Azioni suggerite:\n${actions}`
    );
  }

  // ── Eval guidance ────────────────────────────────────────────────────────
  if (evalResult.level === "low") {
    sections.push(
      `## Nota sulla confidenza\n` +
      `Le fonti disponibili sono limitate (score: ${evalResult.score.toFixed(2)}). ` +
      `Sii trasparente sui limiti della risposta e invita l'utente a fornire più contesto.`
    );
  }

  // ── Generative UI hint ────────────────────────────────────────────────────
  sections.push(
    `## Capacità di rendering UI\n` +
    `Hai accesso a tool di rendering visuale: render_roadmap, render_career_match, ` +
    `render_quiz, render_resource_list, render_action_plan.\n` +
    `Usali quando il contenuto è strutturato e visivamente più utile del testo. ` +
    `Esempi: piani step-by-step → render_roadmap, confronto carriera → render_career_match. ` +
    `NON usarli per risposte conversazionali semplici.`
  );

  return sections.join("\n\n");
}

export function buildVoiceSystemPrompt(name?: string): string {
  const greeting = name ? `Stai parlando con ${name}.` : "";
  return (
    `Sei Wendy, coach vocale di NorthStar. ${greeting}\n` +
    `Rispondi in italiano con MASSIMO 2-3 frasi brevi e dirette.\n` +
    `Tono caldo, naturale. Nessuna lista o markdown — solo parlato fluido.`
  );
}
