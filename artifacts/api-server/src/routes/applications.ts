import { Router, type IRouter } from "express";
import { db, jobApplicationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

// ── GET /api/applications/:userId ──────────────────────────────────────
router.get("/applications/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const apps = await db
    .select()
    .from(jobApplicationsTable)
    .where(eq(jobApplicationsTable.userId, userId))
    .orderBy(desc(jobApplicationsTable.appliedAt));

  res.json({ applications: apps });
});

// ── POST /api/applications ─────────────────────────────────────────────
const createSchema = z.object({
  userId: z.number().int().positive(),
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  url: z.string().url().optional().or(z.literal("")),
  status: z.enum(["saved", "applied", "interview", "offer", "rejected"]).default("saved"),
  notes: z.string().max(2000).optional(),
  salary: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
});

router.post("/applications", async (req, res): Promise<void> => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi", details: parsed.error.flatten() }); return; }

  const { userId, company, role, url, status, notes, salary, location } = parsed.data;

  const [app] = await db.insert(jobApplicationsTable).values({
    userId,
    company,
    role,
    url: url || null,
    status,
    notes: notes || null,
    salary: salary || null,
    location: location || null,
  }).returning();

  res.status(201).json({ application: app });
});

// ── PATCH /api/applications/:id ────────────────────────────────────────
const updateSchema = z.object({
  company: z.string().min(1).max(200).optional(),
  role: z.string().min(1).max(200).optional(),
  url: z.string().url().optional().or(z.literal("")).or(z.null()),
  status: z.enum(["saved", "applied", "interview", "offer", "rejected"]).optional(),
  notes: z.string().max(2000).optional().or(z.null()),
  salary: z.string().max(100).optional().or(z.null()),
  location: z.string().max(200).optional().or(z.null()),
});

router.patch("/applications/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const updates: Record<string, any> = { ...parsed.data, updatedAt: new Date() };
  // Remove undefined values
  Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

  const [updated] = await db
    .update(jobApplicationsTable)
    .set(updates)
    .where(eq(jobApplicationsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Candidatura non trovata" }); return; }
  res.json({ application: updated });
});

// ── DELETE /api/applications/:id ───────────────────────────────────────
router.delete("/applications/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  await db.delete(jobApplicationsTable).where(eq(jobApplicationsTable.id, id));
  res.json({ success: true });
});

export default router;
