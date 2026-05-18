/**
 * ai-wendy.ts — entrypoint AI unificato per Wendy.
 *
 * POST /api/ai/wendy
 *
 * Due pipeline:
 *   Fast path (navigation/simple_qa): chiamata LLM diretta, risposta leggera.
 *   Full path (conversation/planning/deep_analysis): runGrowthAgent() completo con SSE.
 *
 * SECURITY: userId SEMPRE da req.user.id (JWT), mai dal body (SECURITY_RULES.md).
 * PRIVACY: nessun contenuto integrale di messaggi nei log (PRIVACY_DESIGN.md).
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/auth";
import { wendyLimiter } from "../middleware/rate-limit";
import { rootLogger } from "../middleware/logger";
import { checkFeatureAccess } from "../middleware/check-feature";
import { cacheIncr } from "../lib/redis";
import {
  runGrowthAgent,
  loadMemory,
  buildMemorySection,
  resolveWendyRoute,
  buildLightPrompt,
  toolsToOpenAIFormat,
  executeToolCall,
  recordAiCall,
  getLLMForRoute,
  estimateTokens,
  estimateCost,
} from "@workspace/ai-server";
import type { WendyPageContext, CompressedHistory } from "@workspace/ai-server";

const router = Router();

// ── Zod schema ────────────────────────────────────────────────────────────────

const CompressedHistorySchema = z.object({
  summary:        z.string().max(500).optional(),
  recentMessages: z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string().max(2000),
  })).max(12),
  totalTurns: z.number().int().min(0),
});

const WendyPageContextSchema = z.object({
  page:        z.string().max(50),
  entityType:  z.enum(["sector", "profession", "article", "news"]).optional(),
  entityId:    z.number().int().positive().optional(),
  entityName:  z.string().max(100).optional(),
  journeyType: z.string().max(30).optional(),
  data:        z.record(z.string(), z.unknown()).optional(),
});

const WendyRequestSchema = z.object({
  message:           z.string().min(1).max(5000),
  threadId:          z.string().max(100).optional(),
  compressedHistory: CompressedHistorySchema.optional(),
  pageContext:       WendyPageContextSchema.optional(),
  locale:            z.string().max(5).default("it"),
  hasFileAttached:   z.boolean().optional().default(false),
  localHour:         z.number().int().min(0).max(23).optional(),
  localDayOfWeek:    z.number().int().min(0).max(6).optional(),
  focusMode:         z.boolean().optional().default(false),
});

// ── Handler ───────────────────────────────────────────────────────────────────

router.post("/", requireAuth, wendyLimiter, async (req: Request, res: Response) => {
  const parsed = WendyRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Richiesta non valida", details: parsed.error.flatten() });
    return;
  }

  const { message, threadId, compressedHistory, pageContext, locale, hasFileAttached } = parsed.data;

  // SECURITY: userId SEMPRE dal JWT, mai dal body
  const userId    = req.user!.id;
  const isPremium = !!req.user!.stripeSubscriptionId;
  const requestId = randomUUID();
  const startedAt = Date.now();

  // ── Daily message limit per piano ─────────────────────────────────────────
  const FREE_DAILY_LIMIT = parseInt(process.env.WENDY_FREE_DAILY_LIMIT ?? "10");
  const { allowed: isUnlimited } = await checkFeatureAccess(userId, "wendy_unlimited");

  if (!isUnlimited) {
    const today   = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const key     = `wendy:daily:${userId}:${today}`;
    const secondsUntilMidnight = 86400 - (Date.now() / 1000 % 86400 | 0);
    const count   = await cacheIncr(key, secondsUntilMidnight);

    if (count !== null && count > FREE_DAILY_LIMIT) {
      res.setHeader("Content-Type", "text/event-stream");
      res.flushHeaders();
      res.write(`data: ${JSON.stringify({
        type: "gate",
        feature: "wendy_unlimited",
        requiredPlan: "pro",
        used: count - 1,
        limit: FREE_DAILY_LIMIT,
        message: `Hai usato i tuoi ${FREE_DAILY_LIMIT} messaggi gratuiti oggi. Passa a Pro per continuare senza limiti.`,
      })}\n\n`);
      res.end();
      return;
    }
  }

  // ── SSE headers ───────────────────────────────────────────────────────────
  res.setHeader("Content-Type",    "text/event-stream");
  res.setHeader("Cache-Control",   "no-cache");
  res.setHeader("Connection",      "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    // Intercetta tool_call per telemetria — senza rileggere il body
    const d = data as Record<string, unknown>;
    if (d.type === "tool_call" && typeof d.name === "string") {
      toolsUsedInRequest.push(d.name);
      const result = d.result as Record<string, unknown> | null;
      // Ricerca semantica
      if (result?.searchMode === "semantic") searchModeUsed = "semantic";
      else if (result?.searchMode === "keyword" && searchModeUsed === "none") searchModeUsed = "keyword";
      // RAG telemetria: cattura dati da search_rag
      if (d.name === "search_rag" && result) {
        const chunks = (result.chunks as Array<{ similarity?: number; sourceName?: string }>) ?? [];
        ragChunksRetrieved += chunks.length;
        const topSim = chunks[0]?.similarity;
        if (typeof topSim === "number" && (ragTopSimilarity === null || topSim > ragTopSimilarity)) {
          ragTopSimilarity = topSim;
        }
        for (const chunk of chunks) {
          if (chunk.sourceName && !ragSourcesUsed.includes(chunk.sourceName)) {
            ragSourcesUsed.push(chunk.sourceName);
          }
        }
      }
    }
  };

  // Cleanup se il client chiude la connessione
  let aborted = false;
  req.on("close", () => { aborted = true; });

  rootLogger.info({ userId, requestId, locale }, "[ai/wendy] request started");

  let status: "success" | "error_model" | "error_timeout" | "error_ratelimit" | "error_internal" = "success";
  let errorCode: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

  // Telemetria Step 5
  const toolsUsedInRequest: string[] = [];
  let responseCategory: "success" | "insufficient_data" | "refused" | "error_tool" | "error_model" = "success";
  let searchModeUsed: "semantic" | "keyword" | "none" = "none";

  // Telemetria Step 6 — RAG
  let ragChunksRetrieved = 0;
  let ragTopSimilarity: number | null = null;
  const ragSourcesUsed: string[] = [];

  // Routing fuori dal try — serve nel finally per il logging
  const { intent, decision } = resolveWendyRoute({
    userMessage:       message,
    pageContext:       pageContext as WendyPageContext | undefined,
    compressedHistory: compressedHistory as CompressedHistory | undefined,
    isPremium,
    hasFileAttached,
  });

  rootLogger.debug({ userId, intent, model: decision.model, tier: decision.tier }, "[ai/wendy] routed");

  try {

    // ── 2. Fast path: navigation / simple_qa ────────────────────────────
    if (decision.skipFullPipeline) {
      const systemPrompt = buildLightPrompt({
        locale,
        intent,
        pageContext: pageContext as WendyPageContext | undefined,
      });

      const openAiTools = toolsToOpenAIFormat(decision.toolsEnabled);
      const llm = getLLMForRoute({ provider: decision.provider ?? "openrouter" });

      inputTokens = estimateTokens(systemPrompt + message);
      send({ type: "status", value: intent === "navigation" ? "⚡" : "💬" });

      // Tool calling loop — max 3 turni per evitare loop infiniti
      const msgs: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: unknown[] }> = [
        { role: "system", content: systemPrompt },
        { role: "user",   content: message },
      ];

      const MAX_TOOL_TURNS = 3;
      let toolTurns = 0;
      let finalText  = "";

      while (toolTurns < MAX_TOOL_TURNS) {
        const result = await llm.chatWithTools(
          msgs as any,
          openAiTools,
          { model: decision.model, temperature: 0.1, maxTokens: 400 },
        );
        outputTokens += estimateTokens(result.content);

        if (result.toolCalls.length === 0 || result.finishReason === "stop") {
          finalText = result.content;
          break;
        }

        // Appende il messaggio assistant con tool_calls al thread
        msgs.push({
          role:       "assistant",
          content:    result.content ?? "",
          tool_calls: result.toolCalls.map((tc) => ({
            id:       tc.id,
            type:     "function",
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        });

        // Esegui ogni tool call e aggiungi i risultati al thread
        for (const tc of result.toolCalls) {
          const toolResult = await executeToolCall(tc.name, tc.arguments, userId);
          const toolData   = toolResult.ok ? toolResult.data : { error: (toolResult as any).message };
          send({ type: "tool_call", name: tc.name, args: tc.arguments, result: toolResult.ok ? toolData : null });

          // Navigazione client-side — termina subito senza risposta testuale
          if (toolResult.ok && (toolData as any)?.clientSide) {
            send({ type: "done", intent, requestId, usage: { model: decision.model, inputTokens, outputTokens } });
            return;
          }

          msgs.push({ role: "tool", content: JSON.stringify(toolData), tool_call_id: tc.id });
        }

        toolTurns++;
      }

      if (finalText) send({ type: "token", value: finalText });
      send({ type: "done", intent, usage: { model: decision.model, inputTokens, outputTokens } });

    } else {
      // ── 3. Full path: growth agent completo ──────────────────────────
      const userMemory    = await loadMemory(userId);
      const memorySection = buildMemorySection(userMemory);

      // Flatten compressed history per il growth agent
      const flatHistory = [
        ...(compressedHistory?.summary ? [{ role: "assistant" as const, content: `[Riepilogo sessione precedente]\n${compressedHistory.summary}` }] : []),
        ...(compressedHistory?.recentMessages ?? []),
      ];

      inputTokens = estimateTokens(
        memorySection + message + flatHistory.map((m) => m.content).join(" ")
      );

      for await (const event of runGrowthAgent({
        userId,
        sessionId:  threadId ? Number(threadId) : undefined,
        userContext: {
          isPremium,
          memorySection,
          locale,
          journeyType: pageContext?.journeyType,
        },
        history:      flatHistory,
        userMessage:  message,
        requestId,
        wendyIntent:  intent,   // abilita i Wendy domain tools nel full path
      })) {
        if (aborted) break;
        send(event);
        if (event.type === "token") outputTokens += estimateTokens(event.value);
        if (event.type === "done" || event.type === "error") {
          if (event.type === "error") {
            status = "error_model";
            errorCode = "GROWTH_AGENT_ERROR";
            responseCategory = "error_model";
          }
          // Rileva insufficient_data dal done event dell'agente
          if (event.type === "done" && (event as any).evalResult?.level === "low") {
            responseCategory = "insufficient_data";
          }
          break;
        }
      }
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    status           = msg.includes("timeout") ? "error_timeout" :
                       msg.includes("rate")    ? "error_ratelimit" : "error_internal";
    errorCode        = msg.slice(0, 50);
    responseCategory = status.startsWith("error") ? "error_model" : responseCategory;
    rootLogger.error({ err, userId, requestId }, "[ai/wendy] unhandled error");
    send({ type: "error", message: "Qualcosa è andato storto. Riprova.", code: status });

  } finally {
    // Inferisci responseCategory da status se non già impostato
    if (responseCategory === "success" && status !== "success") {
      responseCategory = status.includes("tool") ? "error_tool" : "error_model";
    }
    // Se ci sono stati tool failure e responseCategory è ancora success, segnalalo
    if (toolsUsedInRequest.length > 0 && responseCategory === "success" &&
        toolsUsedInRequest.some(t => t === "__failed")) {
      responseCategory = "error_tool";
    }

    const latencyMs = Date.now() - startedAt;
    recordAiCall({
      requestId,
      userId,
      threadId,
      intent:           intent,
      tier:             decision.tier,
      model:            decision.model,
      inputTokens,
      outputTokens,
      costUsdEst:       estimateCost(decision.model, inputTokens, outputTokens),
      latencyMs,
      totalTurns:       compressedHistory?.totalTurns ?? 0,
      status,
      errorCode,
      locale,
      toolCallsCount:   toolsUsedInRequest.length,
      toolsUsed:        [...new Set(toolsUsedInRequest)],
      responseCategory,
      searchMode:          searchModeUsed,
      ragChunksRetrieved,
      ragTopSimilarity,
      ragSourcesUsed:      [...new Set(ragSourcesUsed)],
    });

    if (!res.writableEnded) res.end();
  }
});

export default router;
