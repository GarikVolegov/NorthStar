import { Router } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod/v4";
import { db, businessIdeasTable } from "@workspace/db";
import { getLLMForRoute } from "@workspace/ai-server/llm/client";
import { selectModelFor } from "@workspace/ai-server";
import { requireAuth } from "../middleware/auth";
import { sendOptionalReadFallback, sendPersistenceWriteError } from "../lib/persistence";

const router = Router();

const IDEA_STATUSES = ["draft", "in_validation", "validated", "discarded"] as const;
const SCORE_KEYS = ["problem", "audience", "solution", "market", "execution"] as const;
const DECISION_STATES = [
  "unclear",
  "needs_test",
  "promising",
  "validated",
  "discard",
  "ready_for_ops",
] as const;

const validationDataSchema = z
  .object({
    canvas: z.record(z.string(), z.string()).optional(),
    scores: z.record(z.string(), z.number()).optional(),
    scoreReasons: z.record(z.string(), z.string()).optional(),
    scoreSuggestions: z.record(z.string(), z.string()).optional(),
    scoreGeneratedAt: z.string().optional(),
    scoreModel: z.string().optional(),
    assumption: z.string().optional(),
    experiment: z.string().optional(),
    oneLiner: z.string().optional(),
    uiVersion: z.string().optional(),
  })
  .passthrough()
  .optional();

const createIdeaSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  ideaText: z.string().trim().max(1000).optional(),
  sector: z.string().trim().max(120).nullable().optional(),
  status: z.enum(IDEA_STATUSES).optional(),
  validationScore: z.number().min(0).max(100).nullable().optional(),
  validationData: validationDataSchema,
});

const updateIdeaSchema = createIdeaSchema.partial();

const radarSuggestionSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    ideaText: z.string().trim().max(1000).optional(),
    canvas: z.record(z.string(), z.string()).optional(),
    assumption: z.string().trim().max(2000).optional(),
    experiment: z.string().trim().max(2000).optional(),
  })
  .optional();

const decisionSuggestionSchema = z
  .object({
    title: z.string().trim().max(200).optional(),
    ideaText: z.string().trim().max(1000).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

function parseIdeaId(raw: string | undefined) {
  if (!raw) return null;
  const id = Number.parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeCreatePayload(body: z.infer<typeof createIdeaSchema>) {
  const title = body.title?.trim() || "Nuova idea";
  const ideaText = body.ideaText?.trim() || "";

  return {
    title,
    ideaText,
    sector: body.sector?.trim() || null,
    status: body.status ?? "draft",
    validationScore: body.validationScore ?? null,
    validationData: body.validationData ?? {},
  };
}

function normalizeUpdatePayload(body: z.infer<typeof updateIdeaSchema>) {
  const data: Record<string, unknown> = { updatedAt: new Date() };

  if ("title" in body) data.title = body.title?.trim() || "Nuova idea";
  if ("ideaText" in body) data.ideaText = body.ideaText?.trim() ?? "";
  if ("sector" in body) data.sector = body.sector?.trim() || null;
  if ("status" in body) data.status = body.status;
  if ("validationScore" in body) data.validationScore = body.validationScore ?? null;
  if ("validationData" in body) data.validationData = body.validationData ?? {};

  return data;
}

async function findOwnedIdea(id: number, userId: number) {
  const [idea] = await db
    .select()
    .from(businessIdeasTable)
    .where(
      and(
        eq(businessIdeasTable.id, id),
        eq(businessIdeasTable.userId, userId),
        isNull(businessIdeasTable.deletedAt),
      ),
    )
    .limit(1);

  return idea;
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Missing JSON object");
  return JSON.parse(candidate.slice(start, end + 1)) as unknown;
}

function normalizeRadarResponse(raw: unknown) {
  const data = safeJsonObject(raw);
  const scoresInput = safeJsonObject(data.scores);
  const reasonsInput = safeJsonObject(data.reasons);
  const suggestionsInput = safeJsonObject(data.suggestions);

  const scores: Record<(typeof SCORE_KEYS)[number], number> = {} as Record<
    (typeof SCORE_KEYS)[number],
    number
  >;
  const reasons: Record<(typeof SCORE_KEYS)[number], string> = {} as Record<
    (typeof SCORE_KEYS)[number],
    string
  >;
  const suggestions: Record<(typeof SCORE_KEYS)[number], string> = {} as Record<
    (typeof SCORE_KEYS)[number],
    string
  >;

  for (const key of SCORE_KEYS) {
    const score = Math.round(Number(scoresInput[key]));
    if (!Number.isFinite(score) || score < 1 || score > 5) {
      throw new Error(`Invalid score for ${key}`);
    }
    scores[key] = score;
    reasons[key] = String(reasonsInput[key] ?? "").trim().slice(0, 260);
    suggestions[key] = String(suggestionsInput[key] ?? "").trim().slice(0, 260);
    if (!reasons[key]) throw new Error(`Missing reason for ${key}`);
    if (score < 3 && !suggestions[key]) throw new Error(`Missing suggestion for ${key}`);
  }

  return { scores, reasons, suggestions };
}

function normalizeDecisionResponse(raw: unknown) {
  const data = safeJsonObject(raw);
  const state = String(data.state ?? "").trim();
  if (!DECISION_STATES.includes(state as (typeof DECISION_STATES)[number])) {
    throw new Error("Invalid decision state");
  }

  const confidence = Math.max(0, Math.min(100, Math.round(Number(data.confidence ?? 60))));
  const nextActionsInput = Array.isArray(data.nextActions) ? data.nextActions : [];
  const nextActions = nextActionsInput
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 5);
  const reason = String(data.reason ?? "").trim().slice(0, 900);
  if (!reason) throw new Error("Missing decision reason");

  return {
    state: state as (typeof DECISION_STATES)[number],
    reason,
    confidence,
    nextActions,
  };
}

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideas = await db
      .select()
      .from(businessIdeasTable)
      .where(and(eq(businessIdeasTable.userId, userId), isNull(businessIdeasTable.deletedAt)))
      .orderBy(desc(businessIdeasTable.updatedAt));

    res.json({ ideas });
  } catch (err) {
    req.log?.error?.({ err }, "business-ideas list error");
    if (sendOptionalReadFallback(req, res, err, "business-ideas.list", { ideas: [] })) return;
    res.status(500).json({ error: "Errore nel caricamento delle idee di business" });
  }
});

router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseIdeaId(req.params.id);
    if (!ideaId) {
      res.status(400).json({ error: "ID idea non valido" });
      return;
    }

    const idea = await findOwnedIdea(ideaId, userId);
    if (!idea) {
      res.status(404).json({ error: "Idea non trovata" });
      return;
    }

    res.json({ idea });
  } catch (err) {
    req.log?.error?.({ err }, "business-ideas detail error");
    if (sendOptionalReadFallback(req, res, err, "business-ideas.detail", { idea: null })) return;
    res.status(500).json({ error: "Errore nel caricamento dell'idea di business" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const parsed = createIdeaSchema.parse(req.body ?? {});
    const payload = normalizeCreatePayload(parsed);

    const [idea] = await db
      .insert(businessIdeasTable)
      .values({
        userId,
        ...payload,
      })
      .returning();

    res.status(201).json({ idea });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Dati idea non validi", fields: err.flatten().fieldErrors });
      return;
    }
    req.log?.error?.({ err }, "business-ideas create error");
    if (sendPersistenceWriteError(req, res, err, "business-ideas.create")) return;
    res.status(500).json({ error: "Errore nella creazione dell'idea di business" });
  }
});

router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseIdeaId(req.params.id);
    if (!ideaId) {
      res.status(400).json({ error: "ID idea non valido" });
      return;
    }

    const existing = await findOwnedIdea(ideaId, userId);
    if (!existing) {
      res.status(404).json({ error: "Idea non trovata" });
      return;
    }

    const parsed = updateIdeaSchema.parse(req.body ?? {});
    const [idea] = await db
      .update(businessIdeasTable)
      .set(normalizeUpdatePayload(parsed))
      .where(and(eq(businessIdeasTable.id, ideaId), eq(businessIdeasTable.userId, userId)))
      .returning();

    res.json({ idea });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Dati idea non validi", fields: err.flatten().fieldErrors });
      return;
    }
    req.log?.error?.({ err }, "business-ideas update error");
    if (sendPersistenceWriteError(req, res, err, "business-ideas.update")) return;
    res.status(500).json({ error: "Errore nell'aggiornamento dell'idea di business" });
  }
});

router.post("/:id/radar-suggestion", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseIdeaId(req.params.id);
    if (!ideaId) {
      res.status(400).json({ error: "ID idea non valido" });
      return;
    }

    const idea = await findOwnedIdea(ideaId, userId);
    if (!idea) {
      res.status(404).json({ error: "Idea non trovata" });
      return;
    }

    const parsed = radarSuggestionSchema.parse(req.body ?? {});
    const validationData = safeJsonObject(idea.validationData);
    const canvas = parsed?.canvas ?? safeJsonObject(validationData.canvas);
    const title = parsed?.title?.trim() || idea.title || "Nuova idea";
    const ideaText =
      parsed?.ideaText?.trim() ||
      String(validationData.oneLiner ?? idea.ideaText ?? "").trim();
    const assumption = parsed?.assumption?.trim() || String(validationData.assumption ?? "");
    const experiment = parsed?.experiment?.trim() || String(validationData.experiment ?? "");

    const route = selectModelFor("chain-of-thought", { isPremium: false, complexity: "standard" });
    const llm = getLLMForRoute({ provider: route.provider });
    const raw = await llm.chatOnce(
      [
        {
          role: "system",
          content:
            "Sei Wendy, validatrice business di NorthStar. Valuta idee in modo pratico. Rispondi solo con JSON valido, senza markdown.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Valuta questa idea con score 1-5 per problem, audience, solution, market, execution. Fornisci una motivazione breve per ogni score e un suggerimento concreto, obbligatorio se lo score e sotto 3.",
            expectedShape: {
              scores: {
                problem: 1,
                audience: 1,
                solution: 1,
                market: 1,
                execution: 1,
              },
              reasons: {
                problem: "breve motivazione",
                audience: "breve motivazione",
                solution: "breve motivazione",
                market: "breve motivazione",
                execution: "breve motivazione",
              },
              suggestions: {
                problem: "azione concreta",
                audience: "azione concreta",
                solution: "azione concreta",
                market: "azione concreta",
                execution: "azione concreta",
              },
            },
            idea: { title, pitch: ideaText, canvas, assumption, experiment },
          }),
        },
      ],
      { model: route.model, temperature: 0.2, maxTokens: 700 },
    );

    const normalized = normalizeRadarResponse(extractJson(raw));
    res.json({
      ...normalized,
      generatedAt: new Date().toISOString(),
      model: route.model,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Dati radar non validi", fields: err.flatten().fieldErrors });
      return;
    }
    req.log?.error?.({ err }, "business-ideas radar suggestion error");
    res.status(503).json({ error: "Valutazione Wendy non disponibile" });
  }
});

router.post("/:id/decision-suggestion", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseIdeaId(req.params.id);
    if (!ideaId) {
      res.status(400).json({ error: "ID idea non valido" });
      return;
    }

    const idea = await findOwnedIdea(ideaId, userId);
    if (!idea) {
      res.status(404).json({ error: "Idea non trovata" });
      return;
    }

    const parsed = decisionSuggestionSchema.parse(req.body ?? {});
    const validationData = safeJsonObject(idea.validationData);
    const contextData = safeJsonObject(parsed?.data);
    const title = parsed?.title?.trim() || idea.title || "Nuova idea";
    const ideaText =
      parsed?.ideaText?.trim() ||
      String(validationData.oneLiner ?? idea.ideaText ?? "").trim();

    const route = selectModelFor("chain-of-thought", { isPremium: false, complexity: "standard" });
    const llm = getLLMForRoute({ provider: route.provider });
    const raw = await llm.chatOnce(
      [
        {
          role: "system",
          content:
            "Sei Wendy, consulente di validazione business per NorthStar. Consiglia uno stato decisionale pratico. Rispondi solo con JSON valido, senza markdown.",
        },
        {
          role: "user",
          content: JSON.stringify({
            task:
              "Scegli lo stato finale piu utile per questa idea. Usa canvas, radar, esperimenti, competitor, timeline e decisione attuale. Non essere generica: cita i dati usati nella reason.",
            allowedStates: {
              unclear: "Da chiarire",
              needs_test: "Da testare",
              promising: "Promettente",
              validated: "Validata",
              discard: "Da scartare",
              ready_for_ops: "Pronta per piano operativo",
            },
            expectedShape: {
              state: "needs_test",
              reason: "motivazione sintetica basata sui dati dell'idea",
              confidence: 70,
              nextActions: ["azione concreta 1", "azione concreta 2"],
            },
            idea: {
              id: idea.id,
              title,
              pitch: ideaText,
              workflowStatus: idea.status,
              validationScore: idea.validationScore,
              validationData,
              pageContext: contextData,
            },
          }),
        },
      ],
      { model: route.model, temperature: 0.2, maxTokens: 800 },
    );

    const normalized = normalizeDecisionResponse(extractJson(raw));
    res.json({
      ...normalized,
      generatedAt: new Date().toISOString(),
      model: route.model,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Dati decisione non validi", fields: err.flatten().fieldErrors });
      return;
    }
    req.log?.error?.({ err }, "business-ideas decision suggestion error");
    res.status(503).json({ error: "Suggerimento decisione non disponibile" });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseIdeaId(req.params.id);
    if (!ideaId) {
      res.status(400).json({ error: "ID idea non valido" });
      return;
    }

    const existing = await findOwnedIdea(ideaId, userId);
    if (!existing) {
      res.status(404).json({ error: "Idea non trovata" });
      return;
    }

    await db
      .update(businessIdeasTable)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(businessIdeasTable.id, ideaId), eq(businessIdeasTable.userId, userId)));

    res.status(204).send();
  } catch (err) {
    req.log?.error?.({ err }, "business-ideas delete error");
    if (sendPersistenceWriteError(req, res, err, "business-ideas.delete")) return;
    res.status(500).json({ error: "Errore nell'archiviazione dell'idea di business" });
  }
});

router.post("/:id/find-incubators", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseIdeaId(req.params.id);
    if (!ideaId) {
      res.status(400).json({ error: "ID idea non valido" });
      return;
    }

    const idea = await findOwnedIdea(ideaId, userId);
    if (!idea) {
      res.status(404).json({ error: "Idea non trovata" });
      return;
    }

    res.json({ incubators: [] });
  } catch (err) {
    req.log?.error?.({ err }, "business-ideas find-incubators error");
    res.status(500).json({ error: "Errore nella ricerca degli incubatori" });
  }
});

export default router;
