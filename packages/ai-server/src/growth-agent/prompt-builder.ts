import type { RetrievedChunk } from "./retriever";
import type { CoTResult }      from "./chain-of-thought";
import type { EvalResult }     from "./self-evaluator";
import type { RouteDecision }  from "./router-agent";
import { buildToneSection }    from "./tone-adapter";

export interface UserContext {
  name?:         string;
  journeyType?:  string;
  userMode?:     string;
  objectives?:   string[];
  sectorName?:   string;
  pageContext?:  Record<string, unknown>;
  memorySection?: string;
  locale?:       string;
}

export interface BuildSystemPromptOptions {
  userContext:            UserContext & { memorySection?: string };
  personaExamples:        RetrievedChunk[];
  documentChunks:         RetrievedChunk[];
  webResults:             RetrievedChunk[];
  cot:                    CoTResult | null;
  userMessage:            string;
  evalResult:             EvalResult;
  platformChunks?:        RetrievedChunk[];
  routeDecision?:         RouteDecision;
  behaviorPatterns?:      Array<{ patternType: string; description: string; confidence: number }>;
  routingHistorySummary?: string;
  fallbackInstruction?:   string;
  sessionMessageCount?:   number;
  hasSessionGoal?:        boolean;
  pendingFollowUp?:       string;
}

const BASE_SYSTEM = `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi sempre in italiano.
Usa un tono caldo ma concreto — mai vago o generico.
Se non sei sicura, dillo esplicitamente piuttosto che inventare.

Struttura standard delle tue risposte:
1. Riconosci:  mostra che hai capito il messaggio e il contesto
2. Analizza:   dai la tua prospettiva, usa la memoria se pertinente
3. Proponi:    1-3 passi concreti che l'utente può fare
Adatta la struttura in base all'intento (vent salta il passo 3, plan enfatizza azioni).`;

export function buildSystemPrompt(opts: BuildSystemPromptOptions): string {
  const {
    userContext, personaExamples, documentChunks, webResults,
    cot, userMessage, evalResult, platformChunks = [],
    routeDecision, behaviorPatterns, routingHistorySummary,
    fallbackInstruction, sessionMessageCount = 0, hasSessionGoal,
    pendingFollowUp,
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

  // ── Behavioral patterns + routing history ────────────────────────────────
  const patternLines: string[] = [];
  if (behaviorPatterns && behaviorPatterns.length > 0) {
    const top = behaviorPatterns.slice(0, 5);
    top.forEach((p) => {
      patternLines.push(`  - [${p.patternType}] ${p.description} (confidenza: ${(p.confidence * 100).toFixed(0)}%)`);
    });
  }
  if (routingHistorySummary) {
    patternLines.push("", routingHistorySummary);
  }
  if (patternLines.length > 0) {
    sections.push(
      "## Pattern di comportamento rilevati\n" +
      "L'utente mostra pattern ricorrenti nelle conversazioni:\n" +
      patternLines.join("\n") +
      "\n\nSe l'utente è in modalità 'vent' da più turni consecutivi, riconosci lo sfogo ma proponi delicatamente di passare a un piano concreto." +
      "\nSe l'utente torna sullo stesso tema più volte, sottolinealo con naturalezza (es. 'Ogni volta che parliamo di X torni su questo punto…')."
    );
  }

  // ── Tone section (adaptive voice) ─────────────────────────────────────────
  if (userContext.journeyType) {
    sections.push(buildToneSection(userContext.journeyType));
  }

  // ── Session goal — ask if not set ─────────────────────────────────────────
  if (hasSessionGoal === false && sessionMessageCount <= 3) {
    sections.push(
      "## Obiettivo di sessione non ancora impostato\n" +
      "L'utente non ha ancora dichiarato cosa vuole ottenere oggi. " +
      "Se questa è una delle prime interazioni e non sembra uno sfogo, " +
      "chiedi gentilmente: 'In una frase, cosa vorresti ottenere oggi?' " +
      "NON forzare — se l'utente è in vent/reflect, aspetta."
    );
  }

  // ── Goal progress check (every ~5 messages) ──────────────────────────────
  if (hasSessionGoal === true && sessionMessageCount > 0 && sessionMessageCount % 5 === 0) {
    sections.push(
      "## Verifica progresso obiettivo\n" +
      "Sono passati alcuni messaggi. Se pertinente, fai un breve check: " +
      "riconosci i progressi e chiedi se la conversazione è sulla strada giusta. " +
      "Sii breve — 1-2 frasi."
    );
  }

  // ── Pending follow-up ────────────────────────────────────────────────────
  if (pendingFollowUp) {
    sections.push(
      "## Follow-up in sospeso\n" +
      `Nella sessione precedente l'utente stava lavorando su: "${pendingFollowUp}". ` +
      "Se appropriato e l'argomento è ancora attuale, chiedi com'è andata. " +
      "Non forzare — se l'utente è passato ad altro, lascia perdere."
    );
  }

  // ── Fallback instruction ──────────────────────────────────────────────────
  if (fallbackInstruction) {
    sections.push(
      "## Istruzione speciale\n" +
      fallbackInstruction
    );
  }

  // ── Platform content (authoritative NorthStar content) ───────────────────
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
