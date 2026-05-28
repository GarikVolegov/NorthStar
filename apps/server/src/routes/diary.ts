import { Router, type Request, type Response } from "express";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import {
  db,
  diaryEntriesTable,
  diaryIdeasTable,
  investorAnalysesTable,
  sectorsTable,
} from "@workspace/db";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord, isOneOf } from "../lib/type-guards";
import { recordSignal } from "../services/discovery-engine";

const router = Router();

const MOODS = ["ottimo", "bene", "neutro", "difficile", "critico"] as const;
const IMPORTANCE = ["bassa", "media", "alta"] as const;
const OUTCOMES = ["opportunita", "rischio", "neutro"] as const;

function readPositiveInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function readOffset(value: unknown): number {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function readTrimmedString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function normalizeTags(value: unknown): string[] {
  const rawTags = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  return Array.from(
    new Set(
      rawTags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean)
        .slice(0, 12),
    ),
  );
}

function parseNullableDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function invalidId(res: Response) {
  res.status(400).json({ error: "ID non valido" });
}

function requireInvestor(req: Request, res: Response): boolean {
  if (req.user?.journeyType !== "investitore") {
    res.status(403).json({ error: "Analisi disponibile solo per investitori" });
    return false;
  }
  return true;
}

router.get("/entries", async (req, res) => {
  const requestedLimit = readPositiveInteger(req.query.limit);
  const limit = Math.min(requestedLimit ?? 20, 100);
  const offset = readOffset(req.query.offset);

  const entries = await db
    .select()
    .from(diaryEntriesTable)
    .where(eq(diaryEntriesTable.userId, req.user!.id))
    .orderBy(desc(diaryEntriesTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json({ entries });
});

router.post("/entries", async (req, res) => {
  const body = asPlainRecord(getRequestBody(req));
  const content = readTrimmedString(body.content);
  const mood = readTrimmedString(body.mood) || null;

  if (content.length < 1 || content.length > 5000) {
    res.status(400).json({ error: "La riflessione deve contenere tra 1 e 5000 caratteri" });
    return;
  }
  if (mood !== null && !isOneOf(mood, MOODS)) {
    res.status(400).json({ error: "Mood non valido" });
    return;
  }

  const [entry] = await db
    .insert(diaryEntriesTable)
    .values({ userId: req.user!.id, content, mood, tags: normalizeTags(body.tags) })
    .returning();

  res.status(201).json({ entry });
});

/**
 * POST /entries/indizi — Diario degli Indizi (tool B3, percorso indeciso).
 *
 * Body atteso:
 *   {
 *     trigger: "energia" | "curiosita" | "flow" | "fatica" | "altro",
 *     context: string,         // dove/quando è successo
 *     content: string,         // descrizione libera dell'indizio
 *     intensity?: number       // 0-1, default 0.6
 *   }
 *
 * Salva l'entry con entryType="indizi" + emette un signal al Discovery Engine.
 */
router.post("/entries/indizi", async (req, res) => {
  const body = asPlainRecord(getRequestBody(req));
  const trigger = readTrimmedString(body.trigger);
  const context = readTrimmedString(body.context);
  const content = readTrimmedString(body.content);
  const intensityRaw = Number(body.intensity);
  const intensity = Number.isFinite(intensityRaw) ? Math.max(0, Math.min(1, intensityRaw)) : 0.6;

  const VALID_TRIGGERS = ["energia", "curiosita", "flow", "fatica", "altro"] as const;
  if (!isOneOf(trigger, VALID_TRIGGERS)) {
    res.status(400).json({ error: "Trigger non valido" });
    return;
  }
  if (content.length < 1 || content.length > 2000) {
    res.status(400).json({ error: "Contenuto fra 1 e 2000 caratteri" });
    return;
  }

  const promptPayload = { trigger, context: context || null, intensity };
  const tags = ["indizio", trigger];

  const [entry] = await db
    .insert(diaryEntriesTable)
    .values({
      userId: req.user!.id,
      content,
      mood: null,
      tags,
      entryType: "indizi",
      promptPayload,
    })
    .returning();

  // Fatica = valenza negativa (cosa ti svuota); gli altri sono positivi.
  const valence = trigger === "fatica" ? -0.6 : 0.6;
  recordSignal({
    userId: req.user!.id,
    signalType: "diary_entry_indizi",
    valence,
    intensity,
    target: trigger,
    payload: { entryId: entry!.id, context: context || null },
  }).catch((err) => req.log?.warn?.({ err }, "[diary] discovery signal failed"));

  res.status(201).json({ entry });
});

router.patch("/entries/:id", async (req, res) => {
  const id = readPositiveInteger(req.params.id);
  if (id === null) {
    invalidId(res);
    return;
  }

  const body = asPlainRecord(getRequestBody(req));
  const updates: Partial<typeof diaryEntriesTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.content === "string") {
    const content = readTrimmedString(body.content);
    if (content.length < 1 || content.length > 5000) {
      res.status(400).json({ error: "La riflessione deve contenere tra 1 e 5000 caratteri" });
      return;
    }
    updates.content = content;
  }
  if ("mood" in body) {
    const mood = readTrimmedString(body.mood) || null;
    if (mood !== null && !isOneOf(mood, MOODS)) {
      res.status(400).json({ error: "Mood non valido" });
      return;
    }
    updates.mood = mood;
  }
  if ("tags" in body) updates.tags = normalizeTags(body.tags);

  const [entry] = await db
    .update(diaryEntriesTable)
    .set(updates)
    .where(and(eq(diaryEntriesTable.id, id), eq(diaryEntriesTable.userId, req.user!.id)))
    .returning();

  if (!entry) {
    res.status(404).json({ error: "Riflessione non trovata" });
    return;
  }
  res.json({ entry });
});

router.delete("/entries/:id", async (req, res) => {
  const id = readPositiveInteger(req.params.id);
  if (id === null) {
    invalidId(res);
    return;
  }

  const [deleted] = await db
    .delete(diaryEntriesTable)
    .where(and(eq(diaryEntriesTable.id, id), eq(diaryEntriesTable.userId, req.user!.id)))
    .returning({ id: diaryEntriesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Riflessione non trovata" });
    return;
  }
  res.json({ ok: true });
});

router.get("/ideas", async (req, res) => {
  const ideas = await db
    .select()
    .from(diaryIdeasTable)
    .where(eq(diaryIdeasTable.userId, req.user!.id))
    .orderBy(desc(diaryIdeasTable.createdAt))
    .limit(100);

  res.json({ ideas });
});

router.post("/ideas", async (req, res) => {
  const body = asPlainRecord(getRequestBody(req));
  const content = readTrimmedString(body.content);
  const importance = readTrimmedString(body.importance, "media");
  const emoji = readTrimmedString(body.emoji, "💡").slice(0, 8) || "💡";

  if (content.length < 1 || content.length > 2000) {
    res.status(400).json({ error: "L'idea deve contenere tra 1 e 2000 caratteri" });
    return;
  }
  if (!isOneOf(importance, IMPORTANCE)) {
    res.status(400).json({ error: "Importanza non valida" });
    return;
  }

  const [idea] = await db
    .insert(diaryIdeasTable)
    .values({
      userId: req.user!.id,
      content,
      importance,
      emoji,
      dueDate: parseNullableDate(body.dueDate),
    })
    .returning();

  res.status(201).json({ idea });
});

router.patch("/ideas/:id", async (req, res) => {
  const id = readPositiveInteger(req.params.id);
  if (id === null) {
    invalidId(res);
    return;
  }

  const body = asPlainRecord(getRequestBody(req));
  const updates: Partial<typeof diaryIdeasTable.$inferInsert> = { updatedAt: new Date() };
  if (typeof body.content === "string") {
    const content = readTrimmedString(body.content);
    if (content.length < 1 || content.length > 2000) {
      res.status(400).json({ error: "L'idea deve contenere tra 1 e 2000 caratteri" });
      return;
    }
    updates.content = content;
  }
  if (typeof body.completed === "boolean") updates.completed = body.completed;
  if ("dueDate" in body) updates.dueDate = parseNullableDate(body.dueDate);
  if (typeof body.emoji === "string") updates.emoji = readTrimmedString(body.emoji, "💡").slice(0, 8) || "💡";
  if (typeof body.importance === "string") {
    const importance = readTrimmedString(body.importance);
    if (!isOneOf(importance, IMPORTANCE)) {
      res.status(400).json({ error: "Importanza non valida" });
      return;
    }
    updates.importance = importance;
  }

  const [idea] = await db
    .update(diaryIdeasTable)
    .set(updates)
    .where(and(eq(diaryIdeasTable.id, id), eq(diaryIdeasTable.userId, req.user!.id)))
    .returning();

  if (!idea) {
    res.status(404).json({ error: "Idea non trovata" });
    return;
  }
  res.json({ idea });
});

router.delete("/ideas/:id", async (req, res) => {
  const id = readPositiveInteger(req.params.id);
  if (id === null) {
    invalidId(res);
    return;
  }

  const [deleted] = await db
    .delete(diaryIdeasTable)
    .where(and(eq(diaryIdeasTable.id, id), eq(diaryIdeasTable.userId, req.user!.id)))
    .returning({ id: diaryIdeasTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Idea non trovata" });
    return;
  }
  res.json({ ok: true });
});

router.get("/analyses", async (req, res) => {
  if (!requireInvestor(req, res)) return;

  const analyses = await db
    .select({
      id: investorAnalysesTable.id,
      userId: investorAnalysesTable.userId,
      sectorId: investorAnalysesTable.sectorId,
      sectorName: investorAnalysesTable.sectorName,
      outcome: investorAnalysesTable.outcome,
      notes: investorAnalysesTable.notes,
      tags: investorAnalysesTable.tags,
      createdAt: investorAnalysesTable.createdAt,
      updatedAt: investorAnalysesTable.updatedAt,
      sectorGrowthRate: sectorsTable.growthRate,
      sectorTrend: sectorsTable.trend,
      sectorAutomationRisk: sectorsTable.automationRisk,
    })
    .from(investorAnalysesTable)
    .leftJoin(sectorsTable, eq(investorAnalysesTable.sectorId, sectorsTable.id))
    .where(eq(investorAnalysesTable.userId, req.user!.id))
    .orderBy(desc(investorAnalysesTable.createdAt))
    .limit(100);

  res.json({ analyses });
});

router.post("/analyses", async (req, res) => {
  if (!requireInvestor(req, res)) return;

  const body = asPlainRecord(getRequestBody(req));
  const outcome = readTrimmedString(body.outcome);
  const sectorId = readPositiveInteger(body.sectorId);
  let sectorName = readTrimmedString(body.sectorName);

  if (!isOneOf(outcome, OUTCOMES)) {
    res.status(400).json({ error: "Outcome non valido" });
    return;
  }

  if (sectorId !== null) {
    const [sector] = await db
      .select({ id: sectorsTable.id, name: sectorsTable.name })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, sectorId))
      .limit(1);
    if (!sector) {
      res.status(404).json({ error: "Settore non trovato" });
      return;
    }
    sectorName = sectorName || sector.name;
  }

  if (sectorName.length < 2 || sectorName.length > 120) {
    res.status(400).json({ error: "Nome settore obbligatorio" });
    return;
  }

  const [analysis] = await db
    .insert(investorAnalysesTable)
    .values({
      userId: req.user!.id,
      sectorId,
      sectorName,
      outcome,
      notes: readTrimmedString(body.notes) || null,
      tags: normalizeTags(body.tags),
    })
    .returning();

  res.status(201).json({ analysis });
});

router.delete("/analyses/:id", async (req, res) => {
  if (!requireInvestor(req, res)) return;
  const id = readPositiveInteger(req.params.id);
  if (id === null) {
    invalidId(res);
    return;
  }

  const [deleted] = await db
    .delete(investorAnalysesTable)
    .where(and(eq(investorAnalysesTable.id, id), eq(investorAnalysesTable.userId, req.user!.id)))
    .returning({ id: investorAnalysesTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Analisi non trovata" });
    return;
  }
  res.json({ ok: true });
});

router.get("/recap", async (req, res) => {
  const period = req.query.period === "month" ? "month" : "week";
  const since = new Date();
  since.setDate(since.getDate() - (period === "month" ? 30 : 7));

  const [entriesCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(diaryEntriesTable)
    .where(and(eq(diaryEntriesTable.userId, req.user!.id), gte(diaryEntriesTable.createdAt, since)));

  const [ideasCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(diaryIdeasTable)
    .where(and(eq(diaryIdeasTable.userId, req.user!.id), gte(diaryIdeasTable.createdAt, since)));

  const [completedIdeasRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(diaryIdeasTable)
    .where(
      and(
        eq(diaryIdeasTable.userId, req.user!.id),
        eq(diaryIdeasTable.completed, true),
        gte(diaryIdeasTable.createdAt, since),
      ),
    );

  const recentEntries = await db
    .select({
      id: diaryEntriesTable.id,
      content: diaryEntriesTable.content,
      mood: diaryEntriesTable.mood,
      tags: diaryEntriesTable.tags,
      createdAt: diaryEntriesTable.createdAt,
    })
    .from(diaryEntriesTable)
    .where(and(eq(diaryEntriesTable.userId, req.user!.id), gte(diaryEntriesTable.createdAt, since)))
    .orderBy(desc(diaryEntriesTable.createdAt))
    .limit(20);

  let analysesCount = 0;
  if (req.user?.journeyType === "investitore") {
    const [analysesCountRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(investorAnalysesTable)
      .where(and(eq(investorAnalysesTable.userId, req.user!.id), gte(investorAnalysesTable.createdAt, since)));
    analysesCount = analysesCountRow?.count ?? 0;
  }

  const moodCounts = Object.fromEntries(MOODS.map((mood) => [mood, 0])) as Record<(typeof MOODS)[number], number>;
  const tagCounts = new Map<string, number>();
  for (const entry of recentEntries) {
    if (entry.mood && entry.mood in moodCounts) moodCounts[entry.mood] += 1;
    for (const tag of entry.tags ?? []) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }

  res.json({
    period,
    entriesCount: entriesCountRow?.count ?? 0,
    ideasCount: ideasCountRow?.count ?? 0,
    completedIdeasCount: completedIdeasRow?.count ?? 0,
    analysesCount,
    moodCounts,
    topTags: Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count })),
    latestEntries: recentEntries.slice(0, 5),
  });
});

export default router;
