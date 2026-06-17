/**
 * applications.ts — CRUD reale del tracker candidature (US-004).
 *
 * Persistenza su jobApplicationsTable (packages/db/src/schema/users.ts).
 * SECURITY: userId SEMPRE da req.user.id; ogni query scoped all'owner (no IDOR).
 *
 * NOTA status: la FE usa "interview", il DB enum usa "interviewing". Mappiamo nei
 * due sensi così il contratto FE (applicationTypes.ts) resta invariato.
 */
import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, jobApplicationsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getRequestBody } from "../lib/request-context";

const router = Router();

type DbStatus = (typeof jobApplicationsTable.$inferSelect)["status"];

const FE_STATUSES = ["saved", "applied", "interview", "offer", "rejected"] as const;

function toFeStatus(s: string): string {
  return s === "interviewing" ? "interview" : s;
}
function toDbStatus(s: string): DbStatus {
  return (s === "interview" ? "interviewing" : s) as DbStatus;
}

const createSchema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  url: z.string().max(500).optional().default(""),
  status: z.enum(FE_STATUSES).optional().default("saved"),
  notes: z.string().max(5000).optional().default(""),
  salary: z.string().max(100).optional().default(""),
  location: z.string().max(200).optional().default(""),
});
const updateSchema = createSchema.partial();

function serialize(row: typeof jobApplicationsTable.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    company: row.company,
    role: row.role,
    url: row.url,
    status: toFeStatus(row.status),
    notes: row.notes,
    salary: row.salary,
    location: row.location,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    notesLog: row.notesLog ?? null,
  };
}

/* ─── GET /api/applications/:userId — lista dell'utente (userId dal JWT) ─── */
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(jobApplicationsTable)
      .where(eq(jobApplicationsTable.userId, req.user!.id))
      .orderBy(desc(jobApplicationsTable.updatedAt));
    res.json({ applications: rows.map(serialize) });
  } catch (err) {
    req.log?.error?.({ err }, "applications get error");
    res.status(500).json({ error: "Errore nel caricamento delle candidature" });
  }
});

/* ─── POST /api/applications — crea ─── */
router.post("/", requireAuth, async (req, res) => {
  const parsed = createSchema.safeParse(getRequestBody(req));
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const d = parsed.data;
  try {
    const [row] = await db
      .insert(jobApplicationsTable)
      .values({
        userId: req.user!.id,
        company: d.company,
        role: d.role,
        url: d.url || null,
        status: toDbStatus(d.status),
        notes: d.notes || null,
        salary: d.salary || null,
        location: d.location || null,
      })
      .returning();
    res.status(201).json(row ? serialize(row) : null);
  } catch (err) {
    req.log?.error?.({ err }, "applications create error");
    res.status(500).json({ error: "Errore nella creazione della candidatura" });
  }
});

/* ─── PATCH /api/applications/:id — aggiorna (owner-scoped) ─── */
router.patch("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const parsed = updateSchema.safeParse(getRequestBody(req));
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const d = parsed.data;
  const set: Partial<typeof jobApplicationsTable.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (d.company !== undefined) set.company = d.company;
  if (d.role !== undefined) set.role = d.role;
  if (d.url !== undefined) set.url = d.url || null;
  if (d.status !== undefined) set.status = toDbStatus(d.status);
  if (d.notes !== undefined) set.notes = d.notes || null;
  if (d.salary !== undefined) set.salary = d.salary || null;
  if (d.location !== undefined) set.location = d.location || null;

  try {
    const [row] = await db
      .update(jobApplicationsTable)
      .set(set)
      .where(
        and(
          eq(jobApplicationsTable.id, id),
          eq(jobApplicationsTable.userId, req.user!.id),
        ),
      )
      .returning();
    if (!row) {
      res.status(404).json({ error: "Candidatura non trovata" });
      return;
    }
    res.json(serialize(row));
  } catch (err) {
    req.log?.error?.({ err }, "applications update error");
    res.status(500).json({ error: "Errore nell'aggiornamento della candidatura" });
  }
});

/* ─── DELETE /api/applications/:id — elimina (owner-scoped) ─── */
router.delete("/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  try {
    const [row] = await db
      .delete(jobApplicationsTable)
      .where(
        and(
          eq(jobApplicationsTable.id, id),
          eq(jobApplicationsTable.userId, req.user!.id),
        ),
      )
      .returning({ id: jobApplicationsTable.id });
    if (!row) {
      res.status(404).json({ error: "Candidatura non trovata" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "applications delete error");
    res.status(500).json({ error: "Errore nell'eliminazione della candidatura" });
  }
});

export default router;
