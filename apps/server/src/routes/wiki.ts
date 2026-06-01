import { Router, type Response } from "express";
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

function writeSse(res: Response, event: Record<string, unknown>) {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

function aiStreamError(err: unknown, fallbackCode = "wiki_stream_failed") {
  const message = err instanceof Error ? err.message : String(err ?? "");
  const normalized = message.toLowerCase();
  if (
    normalized.includes("not_configured") ||
    normalized.includes("not configured") ||
    normalized.includes("api key") ||
    normalized.includes("provider")
  ) {
    return {
      type: "error",
      code: "provider_not_configured",
      message: "Il provider AI non e configurato. Controlla le chiavi del servizio e riprova.",
      retryable: false,
      action: "configure_provider",
    };
  }
  return {
    type: "error",
    code: fallbackCode,
    message: "Non sono riuscito a generare la risposta Wiki. Riprova tra poco.",
    retryable: true,
    action: "retry",
  };
}

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
        writeSse(res, { type: "token", value: event.value });
      } else if (event.type === "sources") {
        sourceChunks = event.chunks ?? [];
        writeSse(res, { type: "sources", chunks: event.chunks });
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
        writeSse(res, {
          ...aiStreamError(new Error(event.message ?? "wiki stream error")),
          message: event.message,
        });
        res.end();
        return;
      } else if (event.type === "done") {
        doneEvent = event;
      }
    }

    if (!fullResponse.trim()) {
      const event = { type: "error" as const, message: "empty_stream" };
      recordWikiStreamError({
        requestId,
        userId,
        message: data.message,
        historyLength: data.history?.length ?? 0,
        startedAt,
        event,
        sourceChunks,
      });
      writeSse(res, aiStreamError(new Error("empty stream"), "empty_stream"));
      res.end();
      return;
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

      writeSse(res, { type: "followUp", questions: suggestedQuestions });
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

    writeSse(res, {
      type: "done",
      requestId,
      model: doneTelemetry.model,
      reason: doneTelemetry.reason,
      contextSources: doneTelemetry.contextSources,
      usage: doneTelemetry.usage,
    });
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
    writeSse(res, aiStreamError(err));
    res.end();
  }
});

export default router;
