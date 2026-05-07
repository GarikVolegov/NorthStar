/**
 * Prompt Builder v2 — assembles the full system prompt for the growth agent.
 *
 * ARCHITECTURE (in order of injection)
 * ──────────────────────────────────────
 * 1. PERSONA CORE        — who the coach is, its non-negotiable principles
 * 2. TONE PROFILE        — HOW to speak (adapted to journeyType)
 * 3. CHAIN OF THOUGHT    — hidden reasoning summary (what the coach figured out)
 * 4. SOCRATIC DIRECTIVE  — how to close the response (which question type)
 * 5. PERSONA EXAMPLES    — retrieved Q&A showing the coach's voice
 * 6. DOCUMENT KNOWLEDGE  — chunks from ingested documents
 * 7. WEB CONTEXT         — live search results (fallback)
 * 8. USER CONTEXT        — profile, objectives, sector
 *
 * Sections 2-4 are NEW in v2 and implement:
 *   A) Tone adaptation per journeyType
 *   B) Chain-of-Thought hidden reasoning
 *   C) Socratic question engineering
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
}

export interface PromptContext {
  userContext: UserContext;
  personaExamples: RetrievedChunk[];
  documentChunks: RetrievedChunk[];
  webResults: RetrievedChunk[];
  /** Result of the hidden CoT reasoning pass (may be null) */
  cot?: CoTResult | null;
  /** The original user message (needed for Socratic directive) */
  userMessage?: string;
}

// ── PERSONA CORE ──────────────────────────────────────────────────────────────
// This section is FIXED — it defines who the coach IS, regardless of user.
// Tone, style adjustments happen in the TONE section below.
const PERSONA_CORE = `
Sei il Coach di Crescita Personale di NorthStar.

Principi non negoziabili:
1. MAI rispondere con platitudini, luoghi comuni o motivazione vuota.
   ("Credi in te stesso", "Sei capace" → VIETATO)
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
    "(Questi mostrano lo STILE, non le risposte giuste — adattali al contesto attuale)",
    lines.join("\n\n"),
  ].join("\n");
}

function formatDocumentChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const lines = chunks.map((c) => `- [${c.source}, score: ${c.score.toFixed(2)}] ${c.content}`);
  return `## Conoscenza dai documenti\n${lines.join("\n")}`;
}

function formatWebResults(results: RetrievedChunk[]): string {
  if (results.length === 0) return "";
  const lines = results.map(
    (r) => `- [${r.metadata["title"] ?? r.source}](${r.source}) ${r.content}`,
  );
  return `## Fonti online (cita la fonte se usi questo contenuto)\n${lines.join("\n")}`;
}

function formatUserContext(ctx: UserContext): string {
  const parts = [
    `## Profilo utente`,
    `- Nome: ${ctx.name}`,
    `- Percorso: ${ctx.journeyType}`,
    `- Modalità: ${ctx.userMode}`,
    ctx.sectorName ? `- Settore: ${ctx.sectorName}` : null,
    ctx.objectives?.length
      ? `- Obiettivi: ${ctx.objectives.join(", ")}`
      : null,
  ];
  return parts.filter(Boolean).join("\n");
}

// ── MAIN BUILDER ──────────────────────────────────────────────────────────────

export function buildSystemPrompt(ctx: PromptContext): string {
  const sections: string[] = [
    // Fixed identity
    PERSONA_CORE,

    // NEW A: Tone adapted to user's journey
    buildToneSection(ctx.userContext.journeyType),

    // NEW B: Hidden CoT reasoning
    buildCoTSection(ctx.cot ?? null),

    // NEW C: Socratic question directive
    ctx.userMessage ? buildSocraticSection(ctx.userMessage) : "",

    // Retrieved context
    formatPersonaExamples(ctx.personaExamples),
    formatDocumentChunks(ctx.documentChunks),
    formatWebResults(ctx.webResults),

    // User profile
    formatUserContext(ctx.userContext),
  ];

  return sections
    .filter((s) => s.trim().length > 0)
    .join("\n\n---\n\n");
}
