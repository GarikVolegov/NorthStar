/**
 * growth-briefing executor — motivational briefing on the user's active objectives.
 *
 * No parameters required; reads directly from userObjectivesTable.
 */
import { db, userObjectivesTable, objectiveCommentsTable } from "@workspace/db";
import { eq, and, desc, gte, count } from "drizzle-orm";
import { getLLM } from "@workspace/ai-server";
import { rootLogger } from "../../middleware/logger.js";
import type { RoutineExecutor, RoutineResult } from "../routine-types.js";

const log = rootLogger.child({ module: "executor:growth-briefing" });

export const growthBriefingExecutor: RoutineExecutor = async (routine, user): Promise<RoutineResult> => {
  const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" });

  try {
    // 1. Active objectives (completed = false, not deleted)
    const active = await db
      .select({
        id:       userObjectivesTable.id,
        text:     userObjectivesTable.text,
        progress: userObjectivesTable.progress,
        category: userObjectivesTable.category,
        dueDate:  userObjectivesTable.dueDate,
      })
      .from(userObjectivesTable)
      .where(
        and(
          eq(userObjectivesTable.userId, user.id),
          eq(userObjectivesTable.completed, false),
        ),
      )
      .orderBy(desc(userObjectivesTable.createdAt))
      .limit(5);

    if (active.length === 0) {
      return {
        title:     `🚀 Briefing crescita — ${today}`,
        body:      `Ciao **${user.name}**! Non hai ancora obiettivi attivi su NorthStar.\n\nDefinire obiettivi chiari è il primo passo verso la crescita professionale. Inizia oggi aggiungendo il tuo primo traguardo!`,
        ctaLabel:  "Vai agli obiettivi",
        ctaTarget: "/obiettivi",
        metadata:  { objectiveCount: 0, activeObjectives: [] },
      };
    }

    // 2. Count recent comments (last 7 days) per objective
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const commentCounts = await db
      .select({
        objectiveId: objectiveCommentsTable.objectiveId,
        commentCount: count(objectiveCommentsTable.id),
      })
      .from(objectiveCommentsTable)
      .where(gte(objectiveCommentsTable.createdAt, sevenDaysAgo))
      .groupBy(objectiveCommentsTable.objectiveId);

    const commentMap = new Map(commentCounts.map((c) => [c.objectiveId, Number(c.commentCount)]));

    // 3. Build objectives summary for the LLM prompt
    const objectivesSummary = active.map((o) => {
      const comments = commentMap.get(o.id) ?? 0;
      const due      = o.dueDate ? ` (scadenza: ${o.dueDate})` : "";
      return `- "${o.text}"${due} — progresso: ${o.progress}%, commenti ultimi 7 giorni: ${comments}`;
    }).join("\n");

    const activeTitles = active.map((o) => o.text);

    let body: string;
    try {
      const llm  = getLLM();
      body = await llm.chatOnce(
        [
          {
            role:    "system",
            content: "Sei Wendy, coach di crescita professionale su NorthStar. Parla in italiano con tono caldo e motivante.",
          },
          {
            role:    "user",
            content: `Obiettivi attivi di ${user.name}:\n${objectivesSummary}\n\nGenera un briefing motivazionale sui progressi. Max 200 parole.`,
          },
        ],
        { model: "gpt-4o-mini", temperature: 0.7, maxTokens: 400 },
      );
    } catch (llmErr) {
      log.warn({ llmErr, routineId: routine.id }, "[growth-briefing] LLM failed, using fallback");
      const progressList = active.map((o) => `- **${o.text}**: ${o.progress}% completato`).join("\n");
      body = `Ciao **${user.name}**! Ecco il tuo briefing di crescita per oggi.\n\n**I tuoi obiettivi attivi:**\n${progressList}\n\nContinua così — ogni piccolo passo ti avvicina al traguardo!`;
    }

    return {
      title:     `🚀 Briefing crescita — ${today}`,
      body,
      ctaLabel:  "Vai agli obiettivi",
      ctaTarget: "/obiettivi",
      metadata:  { objectiveCount: active.length, activeObjectives: activeTitles },
    };
  } catch (err) {
    log.warn({ err, routineId: routine.id }, "[growth-briefing] executor failed");
    return {
      title:     `🚀 Briefing crescita — ${today}`,
      body:      "Non è stato possibile generare il briefing al momento. Riprova più tardi.",
      ctaLabel:  "Vai agli obiettivi",
      ctaTarget: "/obiettivi",
      metadata:  { objectiveCount: 0, activeObjectives: [], error: String(err) },
    };
  }
};
