import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, professionsTable, educationPathsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

function adminKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey) {
    res.status(503).json({ error: "Admin non configurato. Contatta l'amministratore." });
    return;
  }
  if (req.headers["x-admin-key"] !== adminKey) {
    res.status(403).json({ error: "Accesso non autorizzato." });
    return;
  }
  next();
}

const RIASEC_CODES = ["R", "I", "A", "S", "E", "C"] as const;

const ProfessionBody = z.object({
  title:         z.string().min(2),
  sector:        z.string().min(2),
  riasecFit:     z.array(z.enum(RIASEC_CODES)).min(1),
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

router.get("/catalog/professions", async (req, res): Promise<void> => {
  const showAll = req.headers["x-admin-key"] === process.env.ADMIN_KEY && !!process.env.ADMIN_KEY;
  const rows = showAll
    ? await db.select().from(professionsTable).orderBy(professionsTable.id)
    : await db.select().from(professionsTable).where(eq(professionsTable.isActive, true)).orderBy(professionsTable.id);
  res.json(rows);
});

router.post("/catalog/professions", adminKeyMiddleware, async (req, res): Promise<void> => {
  const parsed = ProfessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
    return;
  }
  const [created] = await db.insert(professionsTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.patch("/catalog/professions/:id", adminKeyMiddleware, async (req, res): Promise<void> => {
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

router.delete("/catalog/professions/:id", adminKeyMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  await db.update(professionsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(professionsTable.id, id));
  res.json({ ok: true });
});

router.get("/catalog/education-paths", async (req, res): Promise<void> => {
  const showAll = req.headers["x-admin-key"] === process.env.ADMIN_KEY && !!process.env.ADMIN_KEY;
  const rows = showAll
    ? await db.select().from(educationPathsTable).orderBy(educationPathsTable.id)
    : await db.select().from(educationPathsTable).where(eq(educationPathsTable.isActive, true)).orderBy(educationPathsTable.id);
  res.json(rows);
});

router.post("/catalog/education-paths", adminKeyMiddleware, async (req, res): Promise<void> => {
  const parsed = EducationPathBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", details: parsed.error.issues });
    return;
  }
  const [created] = await db.insert(educationPathsTable).values(parsed.data).returning();
  res.status(201).json(created);
});

router.patch("/catalog/education-paths/:id", adminKeyMiddleware, async (req, res): Promise<void> => {
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

router.delete("/catalog/education-paths/:id", adminKeyMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }
  await db.update(educationPathsTable).set({ isActive: false, updatedAt: new Date() }).where(eq(educationPathsTable.id, id));
  res.json({ ok: true });
});

export default router;
