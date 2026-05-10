import { Router, type IRouter } from "express";
import { db, professionsTable, educationPathsTable, professionEducationPathsTable, sectorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

// Public endpoint — all active roles with optional sector info
router.get("/roles", async (req, res): Promise<void> => {
  const search = (req.query.search as string | undefined)?.toLowerCase();
  const sectorId = req.query.sector_id ? parseInt(req.query.sector_id as string, 10) : undefined;
  const riasec = req.query.riasec as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 200, 200);

  const allRoles = await db
    .select({
      id: professionsTable.id,
      title: professionsTable.title,
      description: professionsTable.description,
      skills: professionsTable.skills,
      workModes: professionsTable.workModes,
      riasecFit: professionsTable.riasecFit,
      salaryRange: professionsTable.salaryRange,
      growthOutlook: professionsTable.growthOutlook,
      autonomyScore: professionsTable.autonomyScore,
      stabilityScore: professionsTable.stabilityScore,
      sectorId: professionsTable.sectorId,
      sectorName: sectorsTable.name,
      sectorIcon: sectorsTable.icon,
    })
    .from(professionsTable)
    .leftJoin(sectorsTable, eq(professionsTable.sectorId, sectorsTable.id))
    .where(eq(professionsTable.isActive, true))
    .orderBy(professionsTable.title)
    .limit(limit);

  let filtered = allRoles;
  if (search) filtered = filtered.filter((r) => r.title.toLowerCase().includes(search) || (r.description ?? "").toLowerCase().includes(search));
  if (sectorId && !isNaN(sectorId)) filtered = filtered.filter((r) => r.sectorId === sectorId);
  if (riasec) filtered = filtered.filter((r) => (r.riasecFit as string[]).includes(riasec));

  res.json(filtered);
});

router.get("/sectors/:id/roles", async (req, res): Promise<void> => {
  const sectorId = parseInt(req.params.id, 10);
  if (isNaN(sectorId)) {
    res.status(400).json({ error: "ID settore non valido" });
    return;
  }

  const [sector] = await db.select({ id: sectorsTable.id }).from(sectorsTable).where(eq(sectorsTable.id, sectorId));
  if (!sector) {
    res.status(404).json({ error: "Settore non trovato" });
    return;
  }

  const roles = await db
    .select()
    .from(professionsTable)
    .where(and(eq(professionsTable.sectorId, sectorId), eq(professionsTable.isActive, true)))
    .orderBy(professionsTable.title);

  res.json(roles.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    skills: r.skills,
    workModes: r.workModes,
    riasecFit: r.riasecFit,
    salaryRange: r.salaryRange,
    growthOutlook: r.growthOutlook,
    autonomyScore: r.autonomyScore,
    stabilityScore: r.stabilityScore,
  })));
});

router.get("/roles/:id", async (req, res): Promise<void> => {
  const roleId = parseInt(req.params.id, 10);
  if (isNaN(roleId)) {
    res.status(400).json({ error: "ID ruolo non valido" });
    return;
  }

  const [role] = await db
    .select()
    .from(professionsTable)
    .where(and(eq(professionsTable.id, roleId), eq(professionsTable.isActive, true)));

  if (!role) {
    res.status(404).json({ error: "Ruolo non trovato" });
    return;
  }

  const joinRows = await db
    .select({ educationPathId: professionEducationPathsTable.educationPathId })
    .from(professionEducationPathsTable)
    .where(eq(professionEducationPathsTable.professionId, roleId));

  const educationPathIds = joinRows.map((r) => r.educationPathId);

  let educationPaths: Array<typeof educationPathsTable.$inferSelect> = [];
  if (educationPathIds.length > 0) {
    const allPaths = await db
      .select()
      .from(educationPathsTable)
      .where(eq(educationPathsTable.isActive, true));
    educationPaths = allPaths.filter((p) => educationPathIds.includes(p.id));
  }

  let sector = null;
  if (role.sectorId) {
    const [s] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, role.sectorId));
    if (s) {
      sector = { id: s.id, name: s.name, icon: s.icon, color: s.color };
    }
  }

  res.json({
    id: role.id,
    title: role.title,
    description: role.description,
    sector: role.sector,
    sectorId: role.sectorId,
    sectorInfo: sector,
    riasecFit: role.riasecFit,
    skills: role.skills,
    workModes: role.workModes,
    salaryRange: role.salaryRange,
    growthOutlook: role.growthOutlook,
    autonomyScore: role.autonomyScore,
    stabilityScore: role.stabilityScore,
    educationPaths: educationPaths.map((ep) => ({
      id: ep.id,
      path: ep.path,
      type: ep.type,
      duration: ep.duration,
      cost: ep.cost,
      steps: ep.steps,
      careerOutcomes: ep.careerOutcomes,
    })),
  });
});

export default router;
