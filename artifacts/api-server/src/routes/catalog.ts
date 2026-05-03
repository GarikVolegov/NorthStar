import { Router, type IRouter } from "express";
import { db, professionsTable, educationPathsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();

const ProfessionBody = z.object({
  title:         z.string().min(2),
  sector:        z.string().min(2),
  riasecFit:     z.array(z.string()).min(1),
  skills:        z.array(z.string()).min(1),
  workModes:     z.array(z.string()).min(1),
  salaryRange:   z.string().min(1),
  growthOutlook: z.string().min(1),
  isActive:      z.boolean().optional().default(true),
});

const EducationPathBody = z.object({
  path:           z.string().min(2),
  type:           z.enum(["universitario", "professionale", "online", "bootcamp"]),
  duration:       z.string().min(1),
  cost:           z.string().min(1),
  steps:          z.array(z.string()).min(1),
  careerOutcomes: z.array(z.string()).min(1),
  sectorFit:      z.array(z.string()).min(1),
  isActive:       z.boolean().optional().default(true),
});

router.get("/catalog/professions", async (_req, res): Promise<void> => {
  const rows = await db.select().from(professionsTable).orderBy(professionsTable.id);
  res.json(rows);
});

router.post("/catalog/professions", authMiddleware, async (req, res): Promise<void> => {
  const parsed = ProfessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
    return;
  }
  const [created] = await db.insert(professionsTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.patch("/catalog/professions/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = ProfessionBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
    return;
  }
  const [updated] = await db
    .update(professionsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(professionsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Professione non trovata" }); return; }
  res.json(updated);
});

router.delete("/catalog/professions/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  await db.update(professionsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(professionsTable.id, id));
  res.json({ ok: true });
});

router.get("/catalog/education-paths", async (_req, res): Promise<void> => {
  const rows = await db.select().from(educationPathsTable).orderBy(educationPathsTable.id);
  res.json(rows);
});

router.post("/catalog/education-paths", authMiddleware, async (req, res): Promise<void> => {
  const parsed = EducationPathBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
    return;
  }
  const [created] = await db.insert(educationPathsTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.patch("/catalog/education-paths/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = EducationPathBody.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
    return;
  }
  const [updated] = await db
    .update(educationPathsTable)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(educationPathsTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Percorso non trovato" }); return; }
  res.json(updated);
});

router.delete("/catalog/education-paths/:id", authMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  await db.update(educationPathsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(educationPathsTable.id, id));
  res.json({ ok: true });
});

export default router;
