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
});

const WendyRequestSchema = z.object({
  message:           z.string().min(1).max(5000),
  threadId:          z.string().max(100).optional(),
  compressedHistory: CompressedHistorySchema.optional(),
  pageContext:       WendyPageContextSchema.optional(),
  locale:            z.string().max(5).default("it"),
  hasFileAttached:   z.boolean().optional().default(false),
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

  // ── SSE headers ───────────────────────────────────────────────────────────
  res.setHeader("Content-Type",    "text/event-stream");
  res.setHeader("Cache-Control",   "no-cache");
  res.setHeader("Connection",      "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data: object) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Cleanup se il client chiude la connessione
  let aborted = false;
  req.on("close", () => { aborted = true; });

  rootLogger.info({ userId, requestId, locale }, "[ai/wendy] request started");

  let status: "success" | "error_model" | "error_timeout" | "error_ratelimit" | "error_internal" = "success";
  let errorCode: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;

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

      const tools = toolsToOpenAIFormat(decision.toolsEnabled);
      const llm   = getLLMForRoute({
        provider: (decision.model.includes("llama") || decision.model.includes("groq"))
          ? "groq"
          : decision.model.includes("openai") || decision.model.includes("gpt")
            ? "openai"
            : "openrouter",
      });

      inputTokens = estimateTokens(systemPrompt + message);

      send({ type: "status", value: intent === "navigation" ? "⚡" : "💬" });

      const response = await llm.chatOnce(
        [
          { role: "system",  content: systemPrompt },
          { role: "user",    content: message },
        ],
        { model: decision.model, temperature: 0.1, maxTokens: 300 },
      );

      outputTokens = estimateTokens(response);

      // Prova a parsare tool call JSON, altrimenti testo normale
      let toolCallHandled = false;
      try {
        const parsed = JSON.parse(response);
        const toolName = parsed?.tool ?? parsed?.name ?? parsed?.function?.name;
        const toolArgs = parsed?.args ?? parsed?.arguments ?? parsed?.function?.arguments ?? {};
        if (toolName) {
          // Esegui il tool call e rimanda il risultato
          const result = await executeToolCall(toolName, toolArgs, userId);
          send({ type: "tool_call", name: toolName, args: toolArgs, result: result.ok ? result.data : null });
          toolCallHandled = true;

          // Se è client-side (navigate, filter_list), non serve risposta testuale
          if (result.ok && (result.data as any)?.clientSide) {
            send({ type: "done", intent, usage: { model: decision.model, inputTokens, outputTokens } });
            return;
          }

          // Altrimenti: manda il risultato al LLM per generare una risposta testuale
          const followUpResponse = await llm.chatOnce(
            [
              { role: "system",    content: buildLightPrompt({ locale, intent, pageContext: pageContext as any }) },
              { role: "user",      content: message },
              { role: "assistant", content: response },
              { role: "tool" as any, content: JSON.stringify(result.ok ? result.data : { error: result.error }) },
            ],
            { model: decision.model, temperature: 0.3, maxTokens: 400 },
          );
          outputTokens += estimateTokens(followUpResponse);
          send({ type: "token", value: followUpResponse });
        }
      } catch { /* non è JSON valido */ }

      if (!toolCallHandled) {
        send({ type: "token", value: response });
      }

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
          userId,
          isPremium,
          memorySection,
          locale,
          journeyType: pageContext?.journeyType,
        },
        history:     flatHistory,
        userMessage: message,
        requestId,
      })) {
        if (aborted) break;
        send(event);
        if (event.type === "token") outputTokens += estimateTokens(event.value);
        if (event.type === "done" || event.type === "error") {
          if (event.type === "error") { status = "error_model"; errorCode = "GROWTH_AGENT_ERROR"; }
          break;
        }
      }
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    status    = msg.includes("timeout") ? "error_timeout" :
                msg.includes("rate")    ? "error_ratelimit" : "error_internal";
    errorCode = msg.slice(0, 50);
    rootLogger.error({ err, userId, requestId }, "[ai/wendy] unhandled error");
    send({ type: "error", message: "Qualcosa è andato storto. Riprova.", code: status });

  } finally {
    // ── 4. Telemetria fire-and-forget ─────────────────────────────────
    const latencyMs = Date.now() - startedAt;
    recordAiCall({
      requestId,
      userId,
      threadId,
      intent:      intent,
      tier:        decision.tier,
      model:       decision.model,
      inputTokens,
      outputTokens,
      costUsdEst:  estimateCost(decision.model, inputTokens, outputTokens),
      latencyMs,
      totalTurns:  compressedHistory?.totalTurns ?? 0,
      status,
      errorCode,
      locale,
    });

    if (!res.writableEnded) res.end();
  }
});

export default router;
