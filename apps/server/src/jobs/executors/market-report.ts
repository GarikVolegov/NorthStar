/**
 * market-report executor — generates an LLM market report for a given sector.
 *
 * parameters: { sector: string, length?: "short" | "long" }
 */
import { db, weakSignalsTable, ragChunksTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { getLLM } from "@workspace/ai-server";
import { rootLogger } from "../../middleware/logger.js";
import type { RoutineExecutor, RoutineResult } from "../routine-types.js";

const log = rootLogger.child({ module: "executor:market-report" });

export const marketReportExecutor: RoutineExecutor = async (routine, _user): Promise<RoutineResult> => {
  const params  = routine.parameters as { sector?: string; length?: "short" | "long" };
  const sector  = params.sector ?? "tecnologia";
  const length  = params.length ?? "short";
  const today   = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  let signalSummary = "";
  let signalCount   = 0;

  try {
    // 1. Try confirmed weak signals first
    const signals = await db
      .select({
        title:       weakSignalsTable.title,
        description: weakSignalsTable.description,
        strength:    weakSignalsTable.strength,
      })
      .from(weakSignalsTable)
      .where(eq(weakSignalsTable.status, "confirmed"))
      .orderBy(desc(weakSignalsTable.lastSeenAt))
      .limit(5);

    if (signals.length > 0) {
      signalCount   = signals.length;
      signalSummary = signals.map((s) => `• ${s.title}: ${s.description}`).join("\n");
    } else {
      // 2. Fallback: RAG chunks with textual sector match
      const chunks = await db
        .select({ content: ragChunksTable.content })
        .from(ragChunksTable)
        .where(sql`${ragChunksTable.sectors} && ARRAY[${sector}]::text[]`)
        .orderBy(desc(ragChunksTable.publishedAt))
        .limit(5);

      if (chunks.length > 0) {
        signalCount   = chunks.length;
        signalSummary = chunks.map((c) => `• ${c.content.slice(0, 200)}`).join("\n");
      }
    }

    if (!signalSummary) {
      signalSummary = "Nessun segnale disponibile al momento.";
    }

    const reportLength = length === "long" ? "dettagliato (300-400 parole)" : "breve (150-200 parole)";

    let body: string;
    try {
      const llm  = getLLM();
      body = await llm.chatOnce(
        [
          {
            role:    "system",
            content: "Sei un analista di mercato. Scrivi un report conciso in italiano. Usa formato Markdown leggero.",
          },
          {
            role:    "user",
            content: `Settore: ${sector}\nSegnali recenti:\n${signalSummary}\nScrivi un report ${reportLength}.`,
          },
        ],
        { model: "gpt-4o-mini", temperature: 0.5, maxTokens: 600 },
      );
    } catch (llmErr) {
      log.warn({ llmErr, routineId: routine.id }, "[market-report] LLM failed, using fallback body");
      body = `**Report ${sector} — ${today}**\n\nSegnali rilevati:\n${signalSummary}\n\n*Report completo non disponibile al momento.*`;
    }

    return {
      title:     `📊 Report ${sector} — ${today}`,
      body,
      ctaLabel:  "Esplora il settore",
      ctaTarget: "/growth",
      metadata:  { sector, signalCount },
    };
  } catch (err) {
    log.warn({ err, routineId: routine.id }, "[market-report] executor failed");
    return {
      title:     `📊 Report ${sector} — ${today}`,
      body:      `Non è stato possibile generare il report per **${sector}** al momento.`,
      ctaLabel:  "Esplora il settore",
      ctaTarget: "/growth",
      metadata:  { sector, signalCount: 0, error: String(err) },
    };
  }
};
