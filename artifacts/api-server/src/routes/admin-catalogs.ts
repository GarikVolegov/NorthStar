import { Router } from "express";
import { db, sectorsTable, professionsTable, educationPathsTable, growthArticlesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const ADMIN_KEY = process.env.ADMIN_KEY ?? "northstar-admin";

function adminAuth(req: any, res: any, next: any) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    res.status(401).json({ error: "Non autorizzato" }); return;
  }
  next();
}

// ─── SECTORS ──────────────────────────────────────────────────────────────────

router.get("/admin/catalogs/sectors", adminAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(sectorsTable).orderBy(sectorsTable.name);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Errore DB" }); }
});

router.post("/admin/catalogs/sectors", adminAuth, async (req, res): Promise<void> => {
  try {
    const body = req.body;
    const [created] = await db.insert(sectorsTable).values({
      name: body.name,
      description: body.description ?? "",
      riasecTypes: body.riasecTypes ?? [],
      skills: body.skills ?? [],
      avgSalaryMin: Number(body.avgSalaryMin ?? 0),
      avgSalaryMax: Number(body.avgSalaryMax ?? 0),
      growthRate: Number(body.growthRate ?? 0),
      automationRisk: body.automationRisk ?? "medium",
      scalability: body.scalability ?? "medium",
      trend: body.trend ?? "stable",
      timeToAutonomy: body.timeToAutonomy ?? "1-2 anni",
      advantages: body.advantages ?? [],
      disadvantages: body.disadvantages ?? [],
      opportunities: body.opportunities ?? [],
      icon: body.icon ?? "briefcase",
      color: body.color ?? "#6366f1",
    }).returning();
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: "Errore creazione settore" }); }
});

router.put("/admin/catalogs/sectors/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db.update(sectorsTable)
      .set({
        name: body.name,
        description: body.description,
        riasecTypes: body.riasecTypes,
        skills: body.skills,
        avgSalaryMin: body.avgSalaryMin !== undefined ? Number(body.avgSalaryMin) : undefined,
        avgSalaryMax: body.avgSalaryMax !== undefined ? Number(body.avgSalaryMax) : undefined,
        growthRate: body.growthRate !== undefined ? Number(body.growthRate) : undefined,
        automationRisk: body.automationRisk,
        scalability: body.scalability,
        trend: body.trend,
        timeToAutonomy: body.timeToAutonomy,
        icon: body.icon,
        color: body.color,
      })
      .where(eq(sectorsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Settore non trovato" }); return; }
    res.json(updated);
  } catch (e) { res.status(500).json({ error: "Errore aggiornamento settore" }); }
});

router.delete("/admin/catalogs/sectors/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(sectorsTable).where(eq(sectorsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Errore eliminazione settore" }); }
});

// ─── PROFESSIONS ──────────────────────────────────────────────────────────────

router.get("/admin/catalogs/professions", adminAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(professionsTable).orderBy(professionsTable.title);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Errore DB" }); }
});

router.post("/admin/catalogs/professions", adminAuth, async (req, res): Promise<void> => {
  try {
    const body = req.body;
    const [created] = await db.insert(professionsTable).values({
      title: body.title,
      sector: body.sector ?? "",
      sectorId: body.sectorId ? Number(body.sectorId) : null,
      description: body.description,
      riasecFit: body.riasecFit ?? [],
      skills: body.skills ?? [],
      workModes: body.workModes ?? [],
      salaryRange: body.salaryRange ?? "N/D",
      growthOutlook: body.growthOutlook ?? "stable",
      autonomyScore: body.autonomyScore ? Number(body.autonomyScore) : 5,
      stabilityScore: body.stabilityScore ? Number(body.stabilityScore) : 5,
    }).returning();
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: "Errore creazione professione" }); }
});

router.put("/admin/catalogs/professions/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db.update(professionsTable)
      .set({
        title: body.title,
        sector: body.sector,
        sectorId: body.sectorId ? Number(body.sectorId) : undefined,
        description: body.description,
        riasecFit: body.riasecFit,
        skills: body.skills,
        workModes: body.workModes,
        salaryRange: body.salaryRange,
        growthOutlook: body.growthOutlook,
        isActive: body.isActive,
        updatedAt: new Date(),
      })
      .where(eq(professionsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Professione non trovata" }); return; }
    res.json(updated);
  } catch (e) { res.status(500).json({ error: "Errore aggiornamento professione" }); }
});

router.delete("/admin/catalogs/professions/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(professionsTable).where(eq(professionsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Errore eliminazione professione" }); }
});

// ─── EDUCATION PATHS ──────────────────────────────────────────────────────────

router.get("/admin/catalogs/education-paths", adminAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(educationPathsTable).orderBy(educationPathsTable.path);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Errore DB" }); }
});

router.post("/admin/catalogs/education-paths", adminAuth, async (req, res): Promise<void> => {
  try {
    const body = req.body;
    const [created] = await db.insert(educationPathsTable).values({
      path: body.path,
      type: body.type ?? "universitario",
      duration: body.duration ?? "N/D",
      cost: body.cost ?? "N/D",
      steps: body.steps ?? [],
      careerOutcomes: body.careerOutcomes ?? [],
      sectorFit: body.sectorFit ?? [],
    }).returning();
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: "Errore creazione percorso" }); }
});

router.put("/admin/catalogs/education-paths/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db.update(educationPathsTable)
      .set({
        path: body.path,
        type: body.type,
        duration: body.duration,
        cost: body.cost,
        steps: body.steps,
        careerOutcomes: body.careerOutcomes,
        sectorFit: body.sectorFit,
        isActive: body.isActive,
        updatedAt: new Date(),
      })
      .where(eq(educationPathsTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Percorso non trovato" }); return; }
    res.json(updated);
  } catch (e) { res.status(500).json({ error: "Errore aggiornamento percorso" }); }
});

router.delete("/admin/catalogs/education-paths/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(educationPathsTable).where(eq(educationPathsTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Errore eliminazione percorso" }); }
});

// ─── GROWTH ARTICLES ──────────────────────────────────────────────────────────

router.get("/admin/catalogs/growth-articles", adminAuth, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(growthArticlesTable).orderBy(growthArticlesTable.createdAt);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: "Errore DB" }); }
});

router.post("/admin/catalogs/growth-articles", adminAuth, async (req, res): Promise<void> => {
  try {
    const body = req.body;
    const slug = body.slug ?? body.title?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Date.now();
    const [created] = await db.insert(growthArticlesTable).values({
      title: body.title,
      slug,
      category: body.category ?? "generale",
      subcategory: body.subcategory,
      description: body.description ?? "",
      content: body.content ?? "",
      tags: body.tags ?? [],
      difficulty: body.difficulty ?? "base",
      personalityMatches: body.personalityMatches ?? [],
      sectorLinks: body.sectorLinks ?? [],
      status: body.status ?? "published",
      readTimeMinutes: body.readTimeMinutes ? Number(body.readTimeMinutes) : 3,
    }).returning();
    res.status(201).json(created);
  } catch (e) { res.status(500).json({ error: "Errore creazione articolo" }); }
});

router.put("/admin/catalogs/growth-articles/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const body = req.body;
    const [updated] = await db.update(growthArticlesTable)
      .set({
        title: body.title,
        category: body.category,
        subcategory: body.subcategory,
        description: body.description,
        content: body.content,
        tags: body.tags,
        difficulty: body.difficulty,
        personalityMatches: body.personalityMatches,
        sectorLinks: body.sectorLinks,
        status: body.status,
        readTimeMinutes: body.readTimeMinutes ? Number(body.readTimeMinutes) : undefined,
        updatedAt: new Date(),
      })
      .where(eq(growthArticlesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Articolo non trovato" }); return; }
    res.json(updated);
  } catch (e) { res.status(500).json({ error: "Errore aggiornamento articolo" }); }
});

router.delete("/admin/catalogs/growth-articles/:id", adminAuth, async (req, res): Promise<void> => {
  try {
    await db.delete(growthArticlesTable).where(eq(growthArticlesTable.id, Number(req.params.id)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Errore eliminazione articolo" }); }
});

export default router;
