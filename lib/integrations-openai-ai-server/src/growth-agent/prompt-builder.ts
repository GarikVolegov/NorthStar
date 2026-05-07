/**
 * Prompt Builder v3 — adds persistent memory section.
 *
 * SECTIONS (in order):
 *   1. PERSONA CORE        — chi è il coach, principi fissi
 *   2. TONE PROFILE        — come parla (adattato a journeyType)
 *   3. PERSISTENT MEMORY   — fatti biografici + pattern osservati [NEW v3]
 *   4. CHAIN OF THOUGHT    — ragionamento interno nascosto
 *   5. SOCRATIC DIRECTIVE  — come chiudere la risposta
 *   6. PERSONA EXAMPLES    — esempi di stile recuperati dal RAG
 *   7. DOCUMENT KNOWLEDGE  — chunk dai documenti
 *   8. WEB CONTEXT         — risultati web (fallback)
 *   9. USER CONTEXT        — profilo, obiettivi, settore
 */
import type { RetrievedChunk } from "./retriever";
import { buildToneSection } from "./tone-adapter";
import { buildCoTSection, type CoTResult } from "./chain-of-thought";
import { buildSocraticSection } from "./socratic-engine";

export interface UserContext {
  name: string;
  journeyType: string;
  userMode: string;
  objectives?: string[];
  sectorName?: string;
  /** Injected by chat.ts after loadMemory() — pre-formatted prompt section */
  memorySection?: string;
}

export interface PromptContext {
  userContext: UserContext;
  personaExamples: RetrievedChunk[];
  documentChunks: RetrievedChunk[];
  webResults: RetrievedChunk[];
  cot?: CoTResult | null;
  userMessage?: string;
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

// ── FORMATTER HELPERS ─────────────────────────────────────────────────────────

function formatPersonaExamples(examples: RetrievedChunk[]): string {
  if (examples.length === 0) return "";
  const lines = examples.map(
    (e, i) => `### Esempio ${i + 1} — ${e.source}\n${e.content}`,
  );
  return [
    "## Esempi di ragionamento del coach",
    "(Questi mostrano lo STILE — adattali al contesto attuale)",
    lines.join("\n\n"),
  ].join("\n");
}

function formatDocumentChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const lines = chunks.map(
    (c) => `- [${c.source}, ${c.score.toFixed(2)}] ${c.content}`,
  );
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
  const parts = [
    `## Profilo utente`,
    `- Nome: ${ctx.name}`,
    `- Percorso: ${ctx.journeyType}`,
    `- Modalità: ${ctx.userMode}`,
    ctx.sectorName  ? `- Settore: ${ctx.sectorName}` : null,
    ctx.objectives?.length
      ? `- Obiettivi: ${ctx.objectives.join(", ")}` : null,
  ];
  return parts.filter(Boolean).join("\n");
}

// ── MAIN BUILDER ──────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [
    PERSONA_CORE,
    buildToneSection(ctx.userContext.journeyType),

    // [NEW v3] Persistent memory — injected between tone and CoT
    // so the coach "knows the person" before reasoning about the message
    ctx.userContext.memorySection ?? "",

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
