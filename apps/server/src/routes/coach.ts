import { Router } from "express";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, coachMemoryFactsTable, coachSessionsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import {
  wendyLimiter,
  wendyIpLimiter,
  planQuotaLimiter,
} from "../middleware/rate-limit";
import { costGuard } from "../middleware/cost-guard";
import { getEffectivePlan, planMeets } from "../middleware/check-feature";
import {
  recordLlmUsage,
  estimateTokens,
  selectModel,
} from "@workspace/ai-server";
import { getLLM } from "@workspace/ai-server/llm/client";

const router = Router();

const createSessionSchema = z.object({
  title: z.string().min(1).max(100).default("Nuova sessione"),
  firstMessage: z.string().min(1).max(2000).optional(),
});

const askSchema = z.object({
  message: z.string().min(1).max(5000),
});

const addMemoryFactSchema = z.object({
  key: z.string().min(1).max(64).default("user_manual"),
  value: z.string().min(1).max(500),
  source: z.enum(["user_manual", "conversation", "onboarding", "system"]).default("user_manual"),
});

const COACH_SYSTEM_PROMPT = `Sei Wendy, coach di crescita personale e orientamento professionale di NorthStar.
Sei empatica, diretta, competente. Rispondi sempre in italiano.
Usa un tono caldo ma concreto — mai vago o generico.
Se non sei sicura, dillo esplicitamente piuttosto che inventare.`;

// ── LIST sessions ──────────────────────────────────────────────
type MemoryFactRow = {
  id: number;
  key: string;
  value: string;
  sourceSessionId: number | null;
  confirmedCount: number;
  createdAt: Date | string;
};

function memorySource(row: Pick<MemoryFactRow, "key" | "sourceSessionId">): string {
  if (row.key.startsWith("user_manual")) return "user_manual";
  if (row.key.startsWith("onboarding")) return "onboarding";
  if (row.sourceSessionId) return "conversation";
  return "system";
}

function serializeMemoryFact(row: MemoryFactRow) {
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;
  return {
    id: row.id,
    key: row.key,
    value: row.value,
    source: memorySource(row),
    confirmedCount: row.confirmedCount,
    createdAt,
  };
}

function manualMemoryKey(inputKey: string, source: string): string {
  const normalized = inputKey.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48);
  if (source === "user_manual" && normalized === "user_manual") {
    return `user_manual_${Date.now().toString(36)}`;
  }
  return normalized || "user_manual";
}

router.get("/memory", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const rows = await db
    .select({
      id: coachMemoryFactsTable.id,
      key: coachMemoryFactsTable.key,
      value: coachMemoryFactsTable.value,
      sourceSessionId: coachMemoryFactsTable.sourceSessionId,
      confirmedCount: coachMemoryFactsTable.confirmedCount,
      createdAt: coachMemoryFactsTable.createdAt,
    })
    .from(coachMemoryFactsTable)
    .where(and(eq(coachMemoryFactsTable.userId, userId), isNull(coachMemoryFactsTable.deletedAt)))
    .orderBy(desc(coachMemoryFactsTable.updatedAt));

  res.json({ facts: rows.map((row) => serializeMemoryFact(row)) });
});

router.post("/memory", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const parsed = addMemoryFactSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Memoria non valida", details: parsed.error.flatten() });
    return;
  }

  const key = manualMemoryKey(parsed.data.key, parsed.data.source);
  const [row] = await db
    .insert(coachMemoryFactsTable)
    .values({
      userId,
      key,
      value: parsed.data.value.trim(),
      sourceSessionId: null,
    })
    .returning({
      id: coachMemoryFactsTable.id,
      key: coachMemoryFactsTable.key,
      value: coachMemoryFactsTable.value,
      sourceSessionId: coachMemoryFactsTable.sourceSessionId,
      confirmedCount: coachMemoryFactsTable.confirmedCount,
      createdAt: coachMemoryFactsTable.createdAt,
    });

  if (!row) {
    res.status(500).json({ error: "Memoria non salvata" });
    return;
  }

  res.status(201).json({ fact: serializeMemoryFact(row) });
});

router.delete("/memory/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = Number.parseInt(req.params.id ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: "ID memoria non valido" });
    return;
  }

  const [row] = await db
    .update(coachMemoryFactsTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(coachMemoryFactsTable.id, id), eq(coachMemoryFactsTable.userId, userId)))
    .returning({ id: coachMemoryFactsTable.id });

  if (!row) {
    res.status(404).json({ error: "Memoria non trovata" });
    return;
  }

  res.status(204).send();
});

router.get("/sessions", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const sessions = await db
    .select({
      id: coachSessionsTable.id,
      title: coachSessionsTable.title,
      messageCount: coachSessionsTable.messages,
      createdAt: coachSessionsTable.createdAt,
      updatedAt: coachSessionsTable.updatedAt,
    })
    .from(coachSessionsTable)
    .where(eq(coachSessionsTable.userId, userId))
    .orderBy(desc(coachSessionsTable.updatedAt));

  res.json(
    sessions.map((s) => ({
      id: s.id,
      title: s.title,
      messageCount: (s.messageCount ?? []).length,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
  );
});

// ── CREATE session ────────────────────────────────────────────
router.post("/sessions", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const data = createSessionSchema.parse(req.body);

  const messages = data.firstMessage
    ? [
        {
          role: "user" as const,
          content: data.firstMessage,
          createdAt: new Date().toISOString(),
        },
      ]
    : [];

  const [session] = await db
    .insert(coachSessionsTable)
    .values({
      userId,
      title: data.title,
      messages,
    })
    .returning();

  res.status(201).json(session);
});

// ── GET single session ────────────────────────────────────────
router.get("/sessions/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id ?? "", 10);

  const [session] = await db
    .select()
    .from(coachSessionsTable)
    .where(
      and(eq(coachSessionsTable.id, id), eq(coachSessionsTable.userId, userId)),
    )
    .limit(1);

  if (!session) {
    res.status(404).json({ error: "Sessione non trovata" });
    return;
  }

  res.json(session);
});

// ── DELETE session ────────────────────────────────────────────
router.delete("/sessions/:id", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = parseInt(req.params.id ?? "", 10);

  const [existing] = await db
    .select()
    .from(coachSessionsTable)
    .where(
      and(eq(coachSessionsTable.id, id), eq(coachSessionsTable.userId, userId)),
    )
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "Sessione non trovata" });
    return;
  }

  await db.delete(coachSessionsTable).where(eq(coachSessionsTable.id, id));
  res.status(204).send();
});

// ── ASK (SSE streaming) ──────────────────────────────────────
router.post(
  "/sessions/:id/ask",
  requireAuth,
  costGuard,
  wendyLimiter,
  wendyIpLimiter,
  planQuotaLimiter,
  async (req, res) => {
    const userId = req.user!.id;
    const id = parseInt(req.params.id ?? "", 10);
    const data = askSchema.parse(req.body);

    const [session] = await db
      .select()
      .from(coachSessionsTable)
      .where(
        and(
          eq(coachSessionsTable.id, id),
          eq(coachSessionsTable.userId, userId),
        ),
      )
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Sessione non trovata" });
      return;
    }

    const log = req.log;

    // ── Load memory ────────────────────────────────────────────
    let memorySection = "";
    try {
      const { loadMemory, buildMemorySection } =
        await import("@workspace/ai-server/growth-agent");
      const userMemory = await loadMemory(userId);
      memorySection = buildMemorySection(userMemory);
    } catch (err) {
      log.warn({ err }, "coach memory load failed");
    }

    // ── Build messages array ────────────────────────────────────
    const systemContent = memorySection
      ? `${COACH_SYSTEM_PROMPT}\n\n${memorySection}`
      : COACH_SYSTEM_PROMPT;

    const history = (session.messages ?? []).map(
      (m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }),
    );

    // ── SSE headers ────────────────────────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      const llm = getLLM();
      const currentPlan = await getEffectivePlan(req.user!.id);
      const route = selectModel({
        isPremium: planMeets(currentPlan, "pro"),
        complexity: data.message.length > 500 ? "deep" : "standard",
      });

      const promptText = systemContent + "\n\n" + data.message;
      const promptTokens = estimateTokens(promptText);

      const stream = await llm.chat(
        [
          { role: "system" as const, content: systemContent },
          ...history.slice(-20),
          { role: "user" as const, content: data.message },
        ],
        {
          model: route.model,
          temperature: route.temperature,
          maxTokens: route.maxTokens,
        },
      );

      const tokenBuffer: string[] = [];
      for await (const delta of stream) {
        tokenBuffer.push(delta);
        res.write(
          `data: ${JSON.stringify({ type: "token", value: delta })}\n\n`,
        );
      }

      const fullResponse = tokenBuffer.join("");
      const completionTokens = estimateTokens(fullResponse);

      recordLlmUsage({
        userId,
        model: route.model,
        promptTokens,
        completionTokens,
        requestType: "coach_chat",
        endpoint: "coach/sessions/:id/ask",
        metadata: JSON.stringify({ sessionId: id, routeReason: route.reason }),
      }).catch((err) => log.warn({ err }, "failed to record LLM usage"));

      // ── Save messages to session ─────────────────────────────
      const updatedMessages = [
        ...(session.messages ?? []),
        {
          role: "user" as const,
          content: data.message,
          createdAt: new Date().toISOString(),
        },
        {
          role: "assistant" as const,
          content: fullResponse,
          createdAt: new Date().toISOString(),
        },
      ];

      await db
        .update(coachSessionsTable)
        .set({
          messages: updatedMessages,
          updatedAt: new Date(),
        })
        .where(eq(coachSessionsTable.id, id));

      // ── Auto-title: name session from first exchange ─────────
      if (history.length <= 1 && session.title === "Nuova sessione") {
        const title =
          data.message.slice(0, 60).trim() +
          (data.message.length > 60 ? "…" : "");
        await db
          .update(coachSessionsTable)
          .set({ title })
          .where(eq(coachSessionsTable.id, id));
      }

      // ── Fire-and-forget: extract + save memory ───────────────
      (async () => {
        try {
          const { extractMemory, mergeMemory } =
            await import("@workspace/ai-server/growth-agent");
          const { withTimeout } = await import("@workspace/ai-server");
          const lastTurns = updatedMessages.slice(-8);
          const extracted = await withTimeout(
            extractMemory(
              lastTurns.map((m: { role: string; content: string }) => ({
                role: m.role,
                content: m.content,
              })),
            ),
            5000,
            "extractMemory",
          );
          if (
            extracted &&
            (extracted.facts.length > 0 || extracted.patterns.length > 0)
          ) {
            await withTimeout(
              mergeMemory(userId, id, extracted),
              3000,
              "mergeMemory",
            );
            log.info(
              {
                facts: extracted.facts.length,
                patterns: extracted.patterns.length,
              },
              "coach memory saved",
            );
          }
        } catch (err) {
          log.warn({ err }, "coach memory save failed/timed out");
        }
      })();

      res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
      res.end();
    } catch (err) {
      log.error({ err }, "coach ask error");
      res.write(
        `data: ${JSON.stringify({ type: "error", message: "Errore durante la generazione" })}\n\n`,
      );
      res.end();
    }
  },
);

export default router;
