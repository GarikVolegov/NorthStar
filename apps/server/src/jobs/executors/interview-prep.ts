/**
 * interview-prep executor — generates 5 likely interview questions for a target company.
 *
 * parameters: { targetCompany: string, targetRole?: string }
 */
import { db, ragChunksTable } from "@workspace/db";
import { desc, ilike } from "drizzle-orm";
import { getLLM } from "@workspace/ai-server";
import { rootLogger } from "../../middleware/logger.js";
import type { RoutineExecutor, RoutineResult } from "../routine-types.js";

const log = rootLogger.child({ module: "executor:interview-prep" });

export const interviewPrepExecutor: RoutineExecutor = async (routine, _user): Promise<RoutineResult> => {
  const params  = routine.parameters as { targetCompany?: string; targetRole?: string };
  const company = params.targetCompany ?? "azienda";
  const role    = params.targetRole    ?? "il ruolo desiderato";

  try {
    // 1. Search recent RAG chunks mentioning the company
    const chunks = await db
      .select({ content: ragChunksTable.content })
      .from(ragChunksTable)
      .where(ilike(ragChunksTable.content, `%${company}%`))
      .orderBy(desc(ragChunksTable.publishedAt))
      .limit(3);

    const news = chunks.length > 0
      ? chunks.map((c) => `• ${c.content.slice(0, 300)}`).join("\n")
      : "Nessuna notizia recente disponibile.";

    let body: string;
    try {
      const llm  = getLLM();
      body = await llm.chatOnce(
        [
          {
            role:    "system",
            content: "Sei un career coach esperto di colloqui. Parla in italiano. Usa formato Markdown leggero.",
          },
          {
            role:    "user",
            content: `Azienda: ${company}, Ruolo: ${role}.\nNotizie recenti:\n${news}\n\nGenera 5 domande probabili nel colloquio con un suggerimento di risposta per ognuna. Struttura ogni domanda come:\n**Domanda N: [testo]**\n*Suggerimento:* [risposta]`,
          },
        ],
        { model: "gpt-4o-mini", temperature: 0.7, maxTokens: 800 },
      );
    } catch (llmErr) {
      log.warn({ llmErr, routineId: routine.id }, "[interview-prep] LLM failed, using fallback");
      body = `**Preparazione colloquio — ${company}**\n\n` +
        [
          "**Domanda 1: Parlami di te e del tuo percorso professionale.**\n*Suggerimento:* Struttura la risposta in 2-3 minuti seguendo il metodo STAR.",
          "**Domanda 2: Perché vuoi lavorare in questa azienda?**\n*Suggerimento:* Ricerca i valori aziendali e collegali alle tue motivazioni.",
          "**Domanda 3: Quali sono i tuoi punti di forza?**\n*Suggerimento:* Cita 3 punti con esempi concreti.",
          "**Domanda 4: Come gestisci situazioni di pressione?**\n*Suggerimento:* Usa un esempio reale con outcome positivo.",
          "**Domanda 5: Dove ti vedi tra 5 anni?**\n*Suggerimento:* Mostra ambizione allineata agli obiettivi dell'azienda.",
        ].join("\n\n");
    }

    return {
      title:     `🎯 Preparazione colloquio: ${company}`,
      body,
      ctaLabel:  "Continua la preparazione",
      ctaTarget: "/interview",
      metadata:  { targetCompany: company, targetRole: role, questionCount: 5 },
    };
  } catch (err) {
    log.warn({ err, routineId: routine.id }, "[interview-prep] executor failed");
    return {
      title:     `🎯 Preparazione colloquio: ${company}`,
      body:      "Non è stato possibile generare la preparazione al momento. Riprova più tardi.",
      ctaLabel:  "Continua la preparazione",
      ctaTarget: "/interview",
      metadata:  { targetCompany: company, targetRole: role, questionCount: 0, error: String(err) },
    };
  }
};
