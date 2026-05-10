/**
 * AI Agents Proxy Route
 * Proxies LLM-intensive tasks to the Python FastAPI microservice (LangChain/LangGraph).
 * Falls back gracefully if the Python service is unavailable.
 *
 * FIX: Added explicit AbortController timeout on all proxy calls to prevent
 * hanging requests when the Python service is down or unresponsive.
 */
import { Router, type IRouter } from "express";
import { z } from "zod";
import { getAuthenticatedUserId, getUserPlan } from "../lib/plan-utils";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const AI_AGENTS_URL = process.env.AI_AGENTS_URL ?? "http://localhost:8000";
// FIX: Explicit timeouts per request type — prevents indefinite hangs
const DEFAULT_TIMEOUT_MS = 30_000;
const CHAT_TIMEOUT_MS = 60_000;  // chat streams may be slower
const HEALTH_TIMEOUT_MS = 5_000;

const AI_TASK_TYPES = [
  "personality_insight",
  "sector_motivation",
  "work_mode_advice",
  "affiliation_materials",
] as const;

type AITaskType = (typeof AI_TASK_TYPES)[number];

const AI_PREMIUM_TASKS = new Set<AITaskType>(["work_mode_advice", "affiliation_materials"]);

const RunRequestSchema = z.object({
  taskType: z.enum(AI_TASK_TYPES),
  payload: z.record(z.unknown()),
});

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(50),
  profile: z.record(z.unknown()).optional(),
});

async function callPythonService(
  path: string,
  body: unknown,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${AI_AGENTS_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const data = await res.json();

    if (!res.ok) {
      return { ok: false, error: (data as { detail?: string }).detail ?? `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    const msg = isTimeout
      ? `Timeout dopo ${timeoutMs}ms — il servizio AI non risponde`
      : err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─── POST /ai-agents/run ────────────────────────────────────────────────────
router.post("/ai-agents/run", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = RunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { taskType, payload } = parsed.data;
  const plan = await getUserPlan(userId);

  if (plan === "free" && AI_PREMIUM_TASKS.has(taskType)) {
    res.status(403).json({
      error: "Piano Premium richiesto",
      message: `Il task AI '${taskType}' richiede un piano Premium.`,
      requiredPlan: "premium",
    });
    return;
  }

  logger.info({ taskType, userId, plan }, "AI agent run request");

  const start = Date.now();
  const result = await callPythonService("/run", {
    task_type: taskType,
    payload,
    plan,
    user_id: userId,
  }, DEFAULT_TIMEOUT_MS);
  const durationMs = Date.now() - start;

  if (!result.ok) {
    logger.warn({ taskType, error: result.error, durationMs }, "AI service unavailable — returning error");
    res.status(503).json({
      error: "Servizio AI temporaneamente non disponibile",
      detail: result.error,
      fallback: true,
    });
    return;
  }

  logger.info({ taskType, durationMs }, "AI agent run completed");
  res.json(result.data);
});

// ─── POST /ai-agents/chat ────────────────────────────────────────────────────
router.post("/ai-agents/chat", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { messages, profile } = parsed.data;
  const plan = await getUserPlan(userId);

  logger.info({ messageCount: messages.length, userId, plan }, "AI chat request");

  // FIX: chat uses longer timeout since LLM streaming may be slower
  const result = await callPythonService("/chat", {
    messages,
    profile: profile ?? {},
    plan,
    user_id: userId,
  }, CHAT_TIMEOUT_MS);

  if (!result.ok) {
    logger.warn({ error: result.error }, "AI chat service unavailable");
    res.status(503).json({
      error: "Chat AI temporaneamente non disponibile",
      detail: result.error,
      fallback: true,
    });
    return;
  }

  res.json(result.data);
});

// ─── GET /ai-agents/health ───────────────────────────────────────────────────
router.get("/ai-agents/health", async (_req, res): Promise<void> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

  try {
    const r = await fetch(`${AI_AGENTS_URL}/health`, { signal: controller.signal });
    clearTimeout(timer);
    const data = await r.json();
    res.json({ proxy: "ok", aiService: data });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    res.status(503).json({
      proxy: "ok",
      aiService: { status: isTimeout ? "timeout" : "unavailable" },
    });
  }
});

export default router;
