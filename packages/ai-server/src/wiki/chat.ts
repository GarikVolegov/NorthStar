import { getLLM } from "../llm/client";
import { retrieve } from "../growth-agent/retriever";
import { logger } from "../logger";

const WIKI_SYSTEM = `Sei un esperto del settore professionale. Rispondi in modo chiaro, dettagliato e aggiornato.
Usa un tono professionale ma accessibile. Rispondi sempre in italiano.
Se non conosci la risposta con certezza, dillo esplicitamente piuttosto che inventare.`;

export interface WikiContext {
  userId: number;
  sectorId: number;
  sectorName: string;
  journeyType?: string;
  workPreference?: string;
  cvText?: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
}

export interface WikiStreamEvent {
  type: "token" | "done" | "error" | "sources";
  value?: string;
  message?: string;
  chunks?: Array<{ content: string; source: string; score: number }>;
}

export async function* streamWikiResponse(ctx: WikiContext): AsyncGenerator<WikiStreamEvent> {
  try {
    const chunks = await retrieve(ctx.message, ctx.userId, {
      topK: 5,
      minScore: 0.30,
      sourceTypes: ["platform_content", "document", "web"],
    });

    if (chunks.length > 0) {
      yield {
        type: "sources",
        chunks: chunks.map((c) => ({
          content: c.content.slice(0, 200),
          source: c.source,
          score: c.score,
        })),
      };
    }

    const contextSection = chunks.length > 0
      ? `\n\n## Contesto dal knowledge base\n${
          chunks.map((c, i) => `[FONTE ${i + 1}] (${c.source}, score: ${c.score.toFixed(2)})\n${c.content}`).join("\n\n")
        }`
      : "";

    const userContextParts: string[] = [];
    if (ctx.journeyType) userContextParts.push(`Tipo percorso: ${ctx.journeyType}`);
    if (ctx.workPreference) userContextParts.push(`Preferenza lavoro: ${ctx.workPreference}`);
    if (ctx.cvText) userContextParts.push(`Competenze da CV: ${ctx.cvText.slice(0, 300)}`);
    const userContextStr = userContextParts.length > 0
      ? `\n\n## Profilo utente\n${userContextParts.join("\n")}`
      : "";

    const systemContent = `${WIKI_SYSTEM}\n\nSettore: ${ctx.sectorName}${contextSection}${userContextStr}`;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemContent },
    ];

    if (ctx.history) {
      messages.push(...ctx.history.slice(-6).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })));
    }

    messages.push({ role: "user", content: ctx.message });

    const llm = getLLM();
    const stream = await llm.chat(messages, {
      model: "gpt-4o-mini",
      temperature: 0.65,
      maxTokens: 800,
    });

    for await (const delta of stream) {
      yield { type: "token", value: delta };
    }

    yield { type: "done" };
  } catch (err) {
    logger.error({ err }, "wiki chat error");
    yield { type: "error", message: "Errore durante la generazione della risposta" };
  }
}
