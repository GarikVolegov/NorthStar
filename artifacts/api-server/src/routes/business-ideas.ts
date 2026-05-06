import { Router } from "express";
import { db } from "@workspace/db";
import { businessIdeasTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";

const router = Router();
const AI_AGENTS_URL = process.env.AI_AGENTS_URL ?? "http://localhost:8000";

async function callAgent(taskType: string, payload: Record<string, unknown>, plan = "premium") {
  const res = await fetch(`${AI_AGENTS_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task_type: taskType, payload, plan }),
  });
  if (!res.ok) throw new Error(`AI agent error: ${res.status}`);
  return res.json();
}

router.get("/business-ideas", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const ideas = await db
    .select()
    .from(businessIdeasTable)
    .where(eq(businessIdeasTable.userId, userId))
    .orderBy(desc(businessIdeasTable.createdAt));
  res.json(ideas);
});

router.post("/business-ideas", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const { ideaText, sector, workType, title } = req.body as {
    ideaText: string;
    sector?: string;
    workType?: string;
    title?: string;
  };

  if (!ideaText?.trim()) {
    res.status(400).json({ error: "ideaText obbligatorio" });
    return;
  }

  const [idea] = await db
    .insert(businessIdeasTable)
    .values({
      userId,
      title: title || ideaText.slice(0, 60),
      ideaText,
      sector: sector || null,
      workType: workType || "autonomous",
      status: "validating",
    })
    .returning();

  res.status(201).json(idea);

  setImmediate(async () => {
    try {
      const agentRes = await callAgent("business_validator", {
        ideaText,
        sector: sector || "non specificato",
        workType: workType || "autonomous",
      });

      if (agentRes.success) {
        const data = agentRes.data as Record<string, unknown>;
        await db
          .update(businessIdeasTable)
          .set({
            status: "validated",
            title: (data.title as string) || idea.title,
            validationScore: data.validation_score as number,
            confidenceLevel: data.confidence_level as string,
            validationData: data,
            updatedAt: new Date(),
          })
          .where(eq(businessIdeasTable.id, idea.id));
      } else {
        await db
          .update(businessIdeasTable)
          .set({ status: "draft", updatedAt: new Date() })
          .where(eq(businessIdeasTable.id, idea.id));
      }
    } catch {
      await db
        .update(businessIdeasTable)
        .set({ status: "draft", updatedAt: new Date() })
        .where(eq(businessIdeasTable.id, idea.id));
    }
  });
});

router.get("/business-ideas/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(req.params.id, 10);
  const [idea] = await db
    .select()
    .from(businessIdeasTable)
    .where(eq(businessIdeasTable.id, id));
  if (!idea || idea.userId !== userId) {
    res.status(404).json({ error: "Non trovata" });
    return;
  }
  res.json(idea);
});

router.delete("/business-ideas/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(req.params.id, 10);
  const [idea] = await db
    .select()
    .from(businessIdeasTable)
    .where(eq(businessIdeasTable.id, id));
  if (!idea || idea.userId !== userId) {
    res.status(404).json({ error: "Non trovata" });
    return;
  }
  await db.delete(businessIdeasTable).where(eq(businessIdeasTable.id, id));
  res.json({ ok: true });
});

router.post("/business-ideas/:id/find-incubators", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(req.params.id, 10);
  const [idea] = await db
    .select()
    .from(businessIdeasTable)
    .where(eq(businessIdeasTable.id, id));
  if (!idea || idea.userId !== userId) {
    res.status(404).json({ error: "Non trovata" });
    return;
  }
  if (idea.status !== "validated" && idea.status !== "incubating") {
    res.status(400).json({ error: "L'idea deve essere validata prima di cercare incubatori" });
    return;
  }

  const vd = (idea.validationData || {}) as Record<string, unknown>;

  try {
    const agentRes = await callAgent("incubator_finder", {
      title: idea.title,
      ideaText: idea.ideaText,
      sector: idea.sector,
      validationScore: idea.validationScore,
      valueProp: vd.value_proposition,
      revenueModel: vd.revenue_model,
    });

    if (agentRes.success) {
      await db
        .update(businessIdeasTable)
        .set({
          status: "incubating",
          incubatorData: agentRes.data,
          updatedAt: new Date(),
        })
        .where(eq(businessIdeasTable.id, idea.id));
      res.json({ ok: true, data: agentRes.data });
    } else {
      res.status(500).json({ error: agentRes.error || "Errore agente" });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
