/**
 * Prompt builder — assembles the final system prompt for the growth agent.
 *
 * Architecture:
 *   1. PERSONA CORE — who the agent is and how it thinks
 *   2. PERSONA EXAMPLES — retrieved Q&A examples (the agent's "voice")
 *   3. DOCUMENT KNOWLEDGE — chunks from ingested documents
 *   4. WEB CONTEXT — live web search results (optional)
 *   5. USER CONTEXT — the user's profile, objectives, journey type
 *
 * Persona examples get a higher priority window than raw documents
 * because they teach reasoning style, not just facts.
 */
import type { RetrievedChunk } from "./retriever";

export interface UserContext {
  name: string;
  journeyType: string; // "indeciso" | "dipendente" | "autonomo" | "investitore"
  userMode: string;
  objectives?: string[];
  sectorName?: string;
}

export interface PromptContext {
  userContext: UserContext;
  personaExamples: RetrievedChunk[];
  documentChunks: RetrievedChunk[];
  webResults: RetrievedChunk[];
}

const PERSONA_CORE = `
Sei il Coach di Crescita Personale di NorthStar.

Il tuo stile di ragionamento:
- Parli in modo diretto, mai generico o motivazionale vuoto.
- Usi domande Socratiche per far emergere la risposta dall'utente, non per 
  darti aria di saggio.
- Distingui sempre tra ciò che l'utente CONTROLLA (azioni, abitudini, focus) 
  e ciò che NON controlla (mercato, opinioni altrui, tempi esterni).
- Quando citi un concetto da un documento o da un autore, lo dici esplicitamente.
- Non incoraggi passivamente. Se vedi un pattern limitante, lo nomini con chiarezza
  e proponi un'alternativa concreta.
- Usi il linguaggio dell'utente: se è informale, sei informale. Se è preciso, 
  sei preciso.
- Rispondi in italiano a meno che l'utente non scriva in inglese.
`.trim();

function formatPersonaExamples(examples: RetrievedChunk[]): string {
  if (examples.length === 0) return "";
  const lines = examples.map(
    (e, i) =>
      `### Esempio ${i + 1} (fonte: ${e.source})\n${e.content}`,
  );
  return `
## Come ragiona il coach (esempi dal tuo corpus personale)
${lines.join("\n\n")}
`.trim();
}

function formatDocumentChunks(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  const lines = chunks.map(
    (c) => `- [${c.source}] ${c.content}`,
  );
  return `
## Conoscenza dai documenti ingested
${lines.join("\n")}
`.trim();
}

function formatWebResults(results: RetrievedChunk[]): string {
  if (results.length === 0) return "";
  const lines = results.map(
    (r) => `- [Web: ${r.metadata["title"] ?? r.source}] ${r.content}`,
  );
  return `
## Informazioni trovate online (da usare se rilevanti, cita la fonte)
${lines.join("\n")}
`.trim();
}

function formatUserContext(ctx: UserContext): string {
  const objectives =
    ctx.objectives && ctx.objectives.length > 0
      ? `Obiettivi attuali: ${ctx.objectives.join(", ")}`
      : "";
  return `
## Profilo utente
- Nome: ${ctx.name}
- Percorso: ${ctx.journeyType}
- Modalità: ${ctx.userMode}
${ctx.sectorName ? `- Settore di interesse: ${ctx.sectorName}` : ""}
${objectives}
`.trim();
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const sections = [
    PERSONA_CORE,
    formatPersonaExamples(ctx.personaExamples),
    formatDocumentChunks(ctx.documentChunks),
    formatWebResults(ctx.webResults),
    formatUserContext(ctx.userContext),
  ].filter(Boolean);

  return sections.join("\n\n---\n\n");
}
