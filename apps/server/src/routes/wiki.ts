import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import type { WikiStreamEvent } from "@workspace/ai-server";
import { requireAuth } from "../middleware/auth";
import { costGuard } from "../middleware/cost-guard";
import { wendyLimiter, wendyIpLimiter, planQuotaLimiter } from "../middleware/rate-limit";
import {
  recordWikiInternalError,
  recordWikiStreamError,
  recordWikiSuccess,
  type WikiTelemetryChunk,
} from "./wiki-telemetry";
import { buildWikiLLMContext } from "../lib/wikillm-context-router";

const router = Router();

const askSchema = z.object({
  message: z.string().min(1).max(5000),
  history: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
  })).optional(),
});

router.post("/:id/ask", requireAuth, costGuard, wendyLimiter, wendyIpLimiter, planQuotaLimiter, async (req, res) => {
  const userId = req.user!.id;
  const sectorId = parseInt(req.params.id ?? "", 10);
  const data = askSchema.parse(req.body);
  const log = req.log;
  const requestId = randomUUID();
  const startedAt = Date.now();
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

    const federatedContext = await buildWikiLLMContext({
      query: data.message,
      userId,
      userRole: req.user!.role,
      includePersonalMemory: false,
      includeWendyBrain: true,
      graphifyProfile: "auto",
    });

    const externalSources = federatedContext.sources.filter((
      source,
    ): source is "rag" | "graphify" | "wendy-brain" =>
      source === "rag" || source === "graphify" || source === "wendy-brain",
    );

    const stream = streamWikiResponse({
      userId,
      sectorId,
      sectorName,
      ...(userRow?.journeyType ? { journeyType: userRow.journeyType } : {}),
      ...(userRow?.workPreference ? { workPreference: userRow.workPreference } : {}),
      ...(userRow?.cvText ? { cvText: userRow.cvText } : {}),
      message: data.message,
      ...(data.history ? { history: data.history } : {}),
      ...(federatedContext.context
        ? { externalContext: { text: federatedContext.context, sources: externalSources } }
        : {}),
    });

    let fullResponse = "";
    let sourceChunks: WikiTelemetryChunk[] = [];
    let doneEvent: WikiStreamEvent | null = null;

    for await (const event of stream) {
      if (event.type === "token") {
        fullResponse += event.value ?? "";
        res.write(`data: ${JSON.stringify({ type: "token", value: event.value })}\n\n`);
      } else if (event.type === "sources") {
        sourceChunks = event.chunks ?? [];
        res.write(`data: ${JSON.stringify({ type: "sources", chunks: event.chunks })}\n\n`);
      } else if (event.type === "error") {
        recordWikiStreamError({
          requestId,
          userId,
          message: data.message,
          historyLength: data.history?.length ?? 0,
          startedAt,
          event,
          sourceChunks,
        });
        res.write(`data: ${JSON.stringify({ type: "error", message: event.message })}\n\n`);
        res.end();
        return;
      } else if (event.type === "done") {
        doneEvent = event;
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

    const doneTelemetry = recordWikiSuccess({
      requestId,
      userId,
      message: data.message,
      historyLength: data.history?.length ?? 0,
      startedAt,
      doneEvent,
      fullResponse,
      sourceChunks,
    });

    res.write(`data: ${JSON.stringify({
      type: "done",
      requestId,
      model: doneTelemetry.model,
      reason: doneTelemetry.reason,
      contextSources: doneTelemetry.contextSources,
      usage: doneTelemetry.usage,
    })}\n\n`);
    res.end();
  } catch (err) {
    log.error({ err }, "wiki ask error");
    recordWikiInternalError({
      requestId,
      userId,
      message: data.message,
      historyLength: data.history?.length ?? 0,
      startedAt,
    });
    res.write(`data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione della risposta" })}\n\n`);
    res.end();
  }
});

export default router;
