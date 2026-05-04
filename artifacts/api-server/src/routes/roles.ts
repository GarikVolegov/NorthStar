import { Router, type IRouter } from "express";
import { db, professionsTable, educationPathsTable, professionEducationPathsTable, sectorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

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
