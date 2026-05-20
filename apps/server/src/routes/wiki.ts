import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";
import { wendyLimiter, wendyIpLimiter, planQuotaLimiter } from "../middleware/rate-limit";

const router = Router();

const askSchema = z.object({
  message: z.string().min(1).max(5000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
});

// ── ASK (SSE streaming with ML personalization) ────────────
router.post("/:id/ask", requireAuth, wendyLimiter, wendyIpLimiter, planQuotaLimiter, async (req, res) => {
  const userId = req.user!.id;
  const sectorId = parseInt(req.params.id ?? "", 10);
  const data = askSchema.parse(req.body);
  const log = req.log;

  const sectorName = `Settore ${sectorId}`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const { streamWikiResponse, suggestFollowUpQuestions } = await import("@workspace/ai-server");
    const { db, usersTable, userProfileSettingsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");

    const [userRow] = await db
      .select({ journeyType: usersTable.journeyType, workPreference: userProfileSettingsTable.workPreference, cvText: userProfileSettingsTable.cvText })
      .from(usersTable)
      .leftJoin(userProfileSettingsTable, eq(usersTable.id, userProfileSettingsTable.userId))
      .where(eq(usersTable.id, userId))
      .limit(1);

    const stream = streamWikiResponse({
      userId,
      sectorId,
      sectorName,
      ...(userRow?.journeyType ? { journeyType: userRow.journeyType } : {}),
      ...(userRow?.workPreference ? { workPreference: userRow.workPreference } : {}),
      ...(userRow?.cvText ? { cvText: userRow.cvText } : {}),
      message: data.message,
      ...(data.history ? { history: data.history } : {}),
    });

    let fullResponse = "";
    for await (const event of stream) {
      if (event.type === "token") {
        fullResponse += event.value ?? "";
        res.write(`data: ${JSON.stringify({ type: "token", value: event.value })}\n\n`);
      } else if (event.type === "sources") {
        res.write(`data: ${JSON.stringify({ type: "sources", chunks: event.chunks })}\n\n`);
      } else if (event.type === "error") {
        res.write(`data: ${JSON.stringify({ type: "error", message: event.message })}\n\n`);
        res.end();
        return;
      }
    }

    if (fullResponse) {
      const suggestedQuestions = await suggestFollowUpQuestions(
        sectorName,
        [
          ...(data.history ?? []),
          { role: "user" as const, content: data.message },
          { role: "assistant" as const, content: fullResponse },
        ],
        userRow?.journeyType ?? undefined,
      );

      res.write(`data: ${JSON.stringify({ type: "followUp", questions: suggestedQuestions })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
    res.end();
  } catch (err) {
    log.error({ err }, "wiki ask error");
    res.write(`data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione della risposta" })}\n\n`);
    res.end();
  }
});

export default router;
