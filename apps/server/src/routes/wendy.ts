import { Router, type Request, type Response } from "express";
import { z } from "zod/v4";
import OpenAI from "openai";
import { optionalAuth } from "../middleware/auth";
import { writeAuditLog } from "../middleware/audit";
import { wendyLimiter, wendyIpLimiter, planQuotaLimiter } from "../middleware/rate-limit";
import { costGuard } from "../middleware/cost-guard";
import { recordLlmUsage, estimateTokens, selectModel, selectModelFor } from "@workspace/ai-server";
import { routerAgent, type RouteDecision } from "@workspace/ai-server/growth-agent/router-agent";
import { getSpecialist, type SpecialistEvent } from "@workspace/ai-server/growth-agent/specialist-agent";
import { buildSystemPrompt, type UserContext } from "@workspace/ai-server/growth-agent/prompt-builder";
import { retrieve } from "@workspace/ai-server/growth-agent/retriever";
import { runChainOfThought } from "@workspace/ai-server/growth-agent/chain-of-thought";
import { evaluateSelf } from "@workspace/ai-server/growth-agent/self-evaluator";
import { supervisorAgent, type SupervisorResult } from "@workspace/ai-server/growth-agent/supervisor-agent";
import { loadMemory, buildMemorySection } from "@workspace/ai-server/growth-agent/memory-manager";
import type { ChatMessage } from "@workspace/ai-server/growth-agent/agent";
import type { RetrievedChunk } from "@workspace/ai-server/growth-agent/retriever";
import type { CoTResult } from "@workspace/ai-server/growth-agent/chain-of-thought";
import type { EvalResult } from "@workspace/ai-server/growth-agent/self-evaluator";

const router = Router();

const askSchema = z.object({
  message: z.string().min(1).max(5000),
  sessionId: z.number().optional(),
});

const WENDY_SYSTEM = `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi sempre in italiano.
Usa un tono calmo ma concreto — mai vago o generico.
Se non sei sicura, dillo esplicitamente piuttosto che inventare.

Hai accesso a una knowledge base con documenti, esempi e risorse.
Se il contesto fornito è sufficiente, usalo come base per la risposta.
Se non è sufficiente, dillo e chiedi più contesto. Non inventare informazioni.`;

function getOpenAI(): OpenAI {
  if (process.env.AI_PROVIDER === "openrouter") {
    const baseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");
    return new OpenAI({ apiKey, baseURL });
  }
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("AI_INTEGRATIONS env vars not configured");
  }
  return new OpenAI({ apiKey, baseURL });
}

function isPremiumUser(req: Request): boolean {
  return !!req.user?.stripeSubscriptionId;
}

const UNAUTHENTICATED_RESPONSE = `Ciao! Sono Wendy, il coach di crescita personale di NorthStar.

Per poterti aiutare al meglio con consigli personalizzati, orientamento professionale e analisi del tuo percorso, devi prima creare un account o effettuare il login.

NorthStar ti aiuta a:
- Scoprire il tuo percorso professionale ideale
- Ricevere consigli personalizzati sulla crescita
- Esplorare settori e professioni
- Prepararti per colloqui di lavoro

Crea un account gratuito per iniziare!`;

async function streamUnauthenticatedResponse(res: Response): Promise<void> {
  res.write(`data: ${JSON.stringify({ type: "sources", chunks: [] })}\n\n`);
  for (const char of UNAUTHENTICATED_RESPONSE) {
    res.write(`data: ${JSON.stringify({ type: "token", content: char })}\n\n`);
    await new Promise((r) => setTimeout(r, 8));
  }
  res.write(`data: ${JSON.stringify({ type: "done", model: "static", reason: "unauthenticated" })}\n\n`);
  res.end();
}

router.post("/ask", optionalAuth, costGuard, wendyLimiter, wendyIpLimiter, planQuotaLimiter, async (req: Request, res: Response) => {
   const data = askSchema.parse(req.body);
   const log = req.log;
   const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

   const isAuthenticated = !!req.user;

   // ── SSE headers ────────────────────────────────────────────
   res.setHeader("Content-Type", "text/event-stream");
   res.setHeader("Cache-Control", "no-cache");
   res.setHeader("Connection", "keep-alive");
   res.setHeader("X-Accel-Buffering", "no");

   try {
     // If not authenticated, return a friendly message explaining how to get started
     if (!isAuthenticated) {
       log.info({ message: data.message }, "[wendy] unauthenticated request — sending onboarding response");
       await streamUnauthenticatedResponse(res);
       return;
     }

     const userId = req.user!.id;

     // Mock mode for testing
     if (process.env.USE_MOCK_AI === "true") {
       res.write(`data: ${JSON.stringify({ type: "sources", chunks: [] })}\n\n`);

       const mockResponse = `Ciao! Ho analizzato la tua domanda.\n\nCome posso aiutarti ulteriormente?`;
       for (const char of mockResponse) {
         res.write(`data: ${JSON.stringify({ type: "token", content: char })}\n\n`);
         await new Promise((r) => setTimeout(r, 15));
       }
       res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
       res.end();

       if (process.env.USE_MOCK_AI !== "true") {
         await recordLlmUsage({
           userId,
           model: "gpt-3.5-turbo",
           promptTokens: estimateTokens(data.message),
           completionTokens: estimateTokens(mockResponse),
           requestType: "wendy_chat",
           endpoint: "wendy/ask",
         });
       }
       return;
     }

     // 1. Load conversation history for context
     const history: ChatMessage[] = [];

     // 2. Route the message to determine which specialist(s) to use
     const routeDecision = await routerAgent.route(data.message, history, requestId);

     // 3. Retrieve relevant context from knowledge base
     let chunks: Array<{ content: string; source: string; score: number }> = [];
     try {
       chunks = await retrieve(data.message, userId, {
         topK: 5,
         minScore: 0.30,
         sourceTypes: ["platform_content", "document", "persona_example"],
       });
     } catch (err) {
       log.warn({ err }, "wendy RAG retrieval failed");
     }

     // 4. Build context section for sources event
     const contextSection = chunks.length > 0
       ? `\n\n## Contesto recuperato dalla knowledge base\n${
           chunks.map((c, i) => `[FONTE ${i + 1}] (${c.source}, score: ${c.score.toFixed(2)})\n${c.content}`).join("\n\n")
         }`
       : "";

     // 5. Send sources first (for compatibility with existing frontend)
     res.write(`data: ${JSON.stringify({ type: "sources", chunks: chunks.map((c) => ({
       content: c.content.slice(0, 200),
       source: c.source,
       score: c.score,
     })) })}\n\n`);

     // 6. Load user memory for context
     let memorySection = "";
     let memoryFactCount = 0;
     try {
       const userMemory = await loadMemory(userId);
       memorySection = buildMemorySection(userMemory);
       memoryFactCount = userMemory.facts.length;
     } catch (err) {
       log.warn({ err }, "wendy memory load failed");
     }

      // 7. Build user context
      const userContext: UserContext = {
        isPremium: !!req.user?.stripeSubscriptionId,
        stripeSubscriptionId: req.user?.stripeSubscriptionId ?? null,
        memorySection,
      };

     // 8. Run the appropriate specialist agent(s)
     const specialist = getSpecialist(routeDecision.domain);

     if (specialist) {
       // Run the specialist agent
       const specialistOpts: any = {
         userId,
         userContext: {
           ...userContext,
           memorySection,
         },
         history,
         userMessage: data.message,
         routeDecision,
         memoryFactCount,
         maxHistory: 12,
         requestId,
         behavioralPatterns: [],
         routingHistorySummary: "",
       };

       // Stream the specialist's response
       let fullResponse = "";
       let sourcesSent = false;
       let supervisorResult: SupervisorResult | undefined;
       let evalResult: EvalResult | undefined;
       let cotResult: CoTResult | null = null;
       let allSources: RetrievedChunk[] = [];

       for await (const event of specialist.run(specialistOpts)) {
         switch (event.type) {
       case "status":
             res.write(`data: ${JSON.stringify({ type: "status", value: event.value })}\n\n`);
             break;
           case "token":
             res.write(`data: ${JSON.stringify({ type: "token", content: event.value })}\n\n`);
             fullResponse += event.value;
             break;
          case "done":
            sourcesSent = true;
            supervisorResult = event.supervisorResult;
            evalResult = event.evalResult;
            cotResult = event.cot ?? null;
            allSources = [...(event.sources ?? [])];
            break;
          case "error":
            log.error({ err: event.message }, "specialist agent error");
            res.write(`data: ${JSON.stringify({ type: "error", message: event.message })}\n\n`);
            res.end();
            return;
         }
       }

       if (!sourcesSent) {
         res.write(`data: ${JSON.stringify({ type: "sources", chunks: [] })}\n\n`);
       }

       const specialistRoute = selectModelFor("specialist-chat", {
         isPremium: !!userContext.isPremium,
       });

       res.write(`data: ${JSON.stringify({
         type: "done",
         model: specialistRoute.model,
         reason: `specialist_${routeDecision.domain}`,
         specialistDomain: routeDecision.domain,
         confidence: routeDecision.confidence,
       })}\n\n`);
       res.end();

       await recordLlmUsage({
         userId,
         model: specialistRoute.model,
         promptTokens: estimateTokens(data.message + (contextSection || "")),
         completionTokens: estimateTokens(fullResponse),
         requestType: "wendy_chat",
         endpoint: "wendy/ask",
         metadata: JSON.stringify({
           messageLength: data.message.length,
           chunkCount: chunks.length,
           sessionId: data.sessionId,
           specialistDomain: routeDecision.domain,
           specialistConfidence: routeDecision.confidence,
         }),
       }).catch((err) => log.warn({ err }, "failed to record LLM usage"));

       writeAuditLog(req, {
         action: "agent_message",
         category: "agent_action",
         metadata: {
           messageLength: data.message.length,
           chunkCount: chunks.length,
           sessionId: data.sessionId,
           model: specialistRoute.model,
           specialistDomain: routeDecision.domain,
           specialistConfidence: routeDecision.confidence,
           endpoint: "wendy/ask",
         },
       });
     } else {
       log.warn({ domain: routeDecision.domain }, "no specialist found, falling back to general Wendy");

       const openai = getOpenAI();
       const WENDY_SYSTEM = `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi sempre in italiano.
Usa un tono calmo ma concreto — mai vago o generico.
Se non sei sicura, dillo esplicitamente piuttosto che inventare.

Hai accesso a una knowledge base con documenti, esempi e risorse.
Se il contesto fornito è sufficiente, usalo come base per la risposta.
Se non è sufficiente, dillo e chiedi più contesto. Non inventare informazioni.`;

       const systemMsg = `${WENDY_SYSTEM}${contextSection}`;

       const route = selectModel({
         isPremium: isPremiumUser(req),
         complexity: data.message.length > 500 ? "deep" : "standard",
       });

       const promptText = systemMsg + "\n\n" + data.message;
       const promptTokens = estimateTokens(promptText);
       let fullResponse = "";

       const stream = await openai.chat.completions.create({
         model: route.model,
         messages: [
           { role: "system", content: systemMsg },
           { role: "user", content: data.message },
         ],
         stream: true,
         temperature: route.temperature,
         max_tokens: route.maxTokens,
       });

       for await (const chunk of stream) {
         const delta = chunk.choices[0]?.delta?.content;
         if (delta) {
           fullResponse += delta;
           res.write(`data: ${JSON.stringify({ type: "token", content: delta })}\n\n`);
         }
       }

       res.write(`data: ${JSON.stringify({
         type: "done",
         model: route.model,
         reason: route.reason,
       })}\n\n`);
       res.end();

       const completionTokens = estimateTokens(fullResponse);

       recordLlmUsage({
         userId,
         model: route.model,
         promptTokens,
         completionTokens,
         requestType: "wendy_chat",
         endpoint: "wendy/ask",
         metadata: JSON.stringify({
           messageLength: data.message.length,
           chunkCount: chunks.length,
           sessionId: data.sessionId,
           routeReason: route.reason,
         }),
       }).catch((err) => log.warn({ err }, "failed to record LLM usage"));

       writeAuditLog(req, {
         action: "agent_message",
         category: "agent_action",
         metadata: {
           messageLength: data.message.length,
           chunkCount: chunks.length,
           sessionId: data.sessionId,
           model: route.model,
           routeReason: route.reason,
           endpoint: "wendy/ask",
         },
       });
     }
   } catch (err) {
     log.error({ err }, "wendy ask error");
     writeAuditLog(req, {
       action: "agent_error",
       category: "agent_action",
       metadata: {
         messageLength: data.message.length,
         error: String(err).slice(0, 500),
         endpoint: "wendy/ask",
       },
     });
     res.write(`data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione della risposta" })}\n\n`);
     res.end();
   }
 });

const voiceSchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.enum(["alloy", "echo", "fable", "onyx", "nova", "shimmer"]).optional(),
  format: z.enum(["mp3", "opus", "aac", "flac", "wav", "pcm16"]).optional(),
  instructions: z.string().max(2000).optional(),
});

router.post("/voice", optionalAuth, async (req: Request, res: Response) => {
  const data = voiceSchema.parse(req.body);
  const log = req.log;

  try {
    const { wendyTextToSpeech } = await import("@workspace/ai-server/audio");
    const audioBuffer = await wendyTextToSpeech(
      data.text,
      data.voice ?? "nova",
      data.format ?? "opus",
      data.instructions,
    );

    const contentType = data.format === "mp3" ? "audio/mpeg"
      : data.format === "opus" ? "audio/ogg"
      : data.format === "wav" ? "audio/wav"
      : data.format === "flac" ? "audio/flac"
      : data.format === "aac" ? "audio/aac"
      : "audio/ogg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", audioBuffer.length.toString());
    res.send(audioBuffer);
  } catch (err) {
    log.error({ err }, "wendy voice error");
    res.status(500).json({ error: "TTS generation failed", message: String(err) });
  }
});

export default router;
