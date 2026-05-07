/**
 * Prompt Builder v4 — adds uncertainty section based on self-evaluation.
 *
 * SECTIONS (in order):
 *   1. PERSONA CORE        — principi fissi del coach
 *   2. TONE PROFILE        — come parla (adattato a journeyType)
 *   3. PERSISTENT MEMORY   — fatti biografici + pattern osservati
 *   4. UNCERTAINTY GUIDE   — [NEW v4] istruzioni basate su confidence level
 *   5. CHAIN OF THOUGHT    — ragionamento interno nascosto
 *   6. SOCRATIC DIRECTIVE  — come chiudere la risposta
 *   7. PERSONA EXAMPLES    — esempi di stile dal RAG
 *   8. DOCUMENT KNOWLEDGE  — chunk dai documenti
 *   9. WEB CONTEXT         — risultati web (fallback)
 *  10. USER CONTEXT        — profilo, obiettivi, settore
 */
import type { RetrievedChunk } from "./retriever";
import { buildToneSection } from "./tone-adapter";
import { buildCoTSection, type CoTResult } from "./chain-of-thought";
import { buildSocraticSection } from "./socratic-engine";
import type { EvalResult } from "./self-evaluator";

export interface UserContext {
  name: string;
  journeyType: string;
  userMode: string;
  objectives?: string[];
  sectorName?: string;
  memorySection?: string;
}

export interface PromptContext {
  userContext: UserContext;
  personaExamples: RetrievedChunk[];
  documentChunks: RetrievedChunk[];
  webResults: RetrievedChunk[];
  cot?: CoTResult | null;
  userMessage?: string;
  evalResult?: EvalResult | null;  // NEW v4
}

// ── PERSONA CORE ──────────────────────────────────────────────────────────────
const PERSONA_CORE = `
Sei il Coach di Crescita Personale di NorthStar.

Principi non negoziabili:
1. MAI rispondere con platitudini, luoghi comuni o motivazione vuota.
2. Ogni risposta deve contenere almeno una cosa CONCRETA e SPECIFICA.
3. Distingui SEMPRE tra ciò che l'utente controlla e ciò che non controlla.
4. Se vedi un pattern limitante, NOMINALO — con rispetto ma senza ammorbidire.
5. Cita la fonte quando usi un concetto da un documento ingested.
6. Rispondi nella lingua dell'utente (italiano default).
7. Lunghezza: risposte dense ma non lunghe. Max 250 parole salvo richiesta esplicita.
`.trim();

// ── UNCERTAINTY GUIDE (NEW v4) ──────────────────────────────────────────────

function buildUncertaintySection(eval_: EvalResult | null | undefined): string {
  if (!eval_ || eval_.level === "high") return "";

  if (eval_.level === "low") {
    const reasons = eval_.reasons.map((r) => `  - ${r}`).join("\n");
    return `
## ⚠️  Attenzione: contesto insufficiente per rispondere con certezza
Score: ${eval_.score.toFixed(2)} / 1.00  (soglia: 0.45)

Motivi:
${reasons}

COMPORTAMENTO RICHIESTO:
- Inizia la risposta con una frase onesta di incertezza.
  Esempio: "Non ho abbastanza contesto per risponderti con precisione — posso condividere
  alcune considerazioni generali, ma sarebbe più utile capire meglio la tua situazione."
- Fai UNA domanda di chiarimento specifica (usa la tecnica Socratica).
- NON inventare conoscenza. NON fingere certezza.
- Se la KB non ha dati rilevanti, dillo esplicitamente e suggerisci di caricare documenti.
`.trim();
  }

  // medium
  return `
## 🔶 Contesto parziale — rispondi con linguaggio moderato
Score: ${eval_.score.toFixed(2)} / 1.00

COMPORTAMENTO RICHIESTO:
- Usa linguaggio che segnala assunzioni: "se ho capito bene...", "basandomi su quello che
  mi hai detto...", "potrebbe essere che..."
- Segnala quando stai ragionando senza dati certi: "non ho abbastanza informazioni
  su [X], ma un'ipotesi ragionevole è..."
- Concludi con una domanda che raccoglie il contesto mancante.
- NON esagerare l'incertezza: hai ancora abbastanza per essere utile.
`.trim();
}

// ── FORMATTER HELPERS ─────────────────────────────────────────────────────────

function formatPersonaExamples(examples: RetrievedChunk[]): string {
  if (examples.length === 0) return "";
  const lines = examples.map(
    (e, i) => `### Esempio ${i + 1} — ${e.source}\n${e.content}`,
  );
  return ["## Esempi di ragionamento del coach", lines.join("\n\n")].join("\n");
}

function formatDocumentChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const lines = chunks.map((c) => `- [${c.source}, ${c.score.toFixed(2)}] ${c.content}`);
  return `## Conoscenza dai documenti\n${lines.join("\n")}`;
}

function formatWebResults(results: RetrievedChunk[]): string {
  if (results.length === 0) return "";
  const lines = results.map(
    (r) => `- [${r.metadata["title"] ?? r.source}](${r.source}) ${r.content}`,
  );
  return `## Fonti online (cita se usi questo contenuto)\n${lines.join("\n")}`;
}

function formatUserContext(ctx: UserContext): string {
  return [
    `## Profilo utente`,
    `- Nome: ${ctx.name}`,
    `- Percorso: ${ctx.journeyType}`,
    `- Modalità: ${ctx.userMode}`,
    ctx.sectorName  ? `- Settore: ${ctx.sectorName}` : null,
    ctx.objectives?.length ? `- Obiettivi: ${ctx.objectives.join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

// ── MAIN BUILDER ──────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: PromptContext): string {
  const sections = [
    PERSONA_CORE,
    buildToneSection(ctx.userContext.journeyType),
    ctx.userContext.memorySection ?? "",
    buildUncertaintySection(ctx.evalResult),       // NEW v4
    buildCoTSection(ctx.cot ?? null),
    ctx.userMessage ? buildSocraticSection(ctx.userMessage) : "",
    formatPersonaExamples(ctx.personaExamples),
    formatDocumentChunks(ctx.documentChunks),
    formatWebResults(ctx.webResults),
    formatUserContext(ctx.userContext),
  ];

  return sections
    .filter((s) => s.trim().length > 0)
    .join("\n\n---\n\n");
}
