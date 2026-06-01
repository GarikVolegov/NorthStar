import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { db, jobApplicationsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { sendOptionalReadFallback, sendPersistenceWriteError } from "../lib/persistence";

export type ApplicationStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

export interface ApplicationNote {
  text: string;
  createdAt: string;
}

export interface ApplicationRecord {
  id: number;
  userId: number;
  company: string;
  role: string;
  url: string | null;
  status: ApplicationStatus;
  notes: string | null;
  salary: string | null;
  location: string | null;
  appliedAt: string | null;
  updatedAt: string | null;
  notesLog: ApplicationNote[] | null;
}

export interface CreateApplicationInput {
  userId: number;
  company: string;
  role: string;
  status?: ApplicationStatus;
  url?: string | null;
  notes?: string | null;
  salary?: string | null;
  location?: string | null;
}

export type UpdateApplicationInput = Partial<Omit<CreateApplicationInput, "userId">>;

export interface ApplicationStore {
  list(userId: number): Promise<ApplicationRecord[]>;
  create(input: CreateApplicationInput): Promise<ApplicationRecord>;
  update(id: number, userId: number, input: UpdateApplicationInput, isAdmin?: boolean): Promise<ApplicationRecord | null>;
  delete(id: number, userId: number, isAdmin?: boolean): Promise<boolean>;
  addNote(id: number, userId: number, text: string, isAdmin?: boolean): Promise<ApplicationRecord | null>;
  deleteNote(id: number, userId: number, noteIndex: number, isAdmin?: boolean): Promise<ApplicationRecord | null>;
}

const APPLICATIONS_NOT_CONFIGURED = {
  status: "not_configured",
  reason: "applications_persistence_not_connected",
  action: "connect_applications_persistence",
} as const;

type DbApplicationRow = typeof jobApplicationsTable.$inferSelect;

function toApiStatus(status: string): ApplicationStatus {
  if (status === "interviewing") return "interview";
  if (status === "withdrawn") return "rejected";
  if (["saved", "applied", "interview", "offer", "rejected"].includes(status)) {
    return status as ApplicationStatus;
  }
  return "saved";
}

function toDbStatus(status: ApplicationStatus): DbApplicationRow["status"] {
  return status === "interview" ? "interviewing" : status;
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNotesLog(value: unknown): ApplicationNote[] | null {
  if (!Array.isArray(value)) return null;
  return value
    .filter((note): note is ApplicationNote => (
      typeof note === "object"
      && note !== null
      && typeof (note as ApplicationNote).text === "string"
      && typeof (note as ApplicationNote).createdAt === "string"
    ));
}

function mapRow(row: DbApplicationRow): ApplicationRecord {
  return {
    id: row.id,
    userId: row.userId,
    company: row.company,
    role: row.role,
    url: row.url,
    status: toApiStatus(row.status),
    notes: row.notes,
    salary: row.salary,
    location: row.location,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
    notesLog: normalizeNotesLog(row.notesLog),
  };
}

function canAccess(userId: number, ownerId: number, isAdmin = false): boolean {
  return isAdmin || userId === ownerId;
}

export function createMemoryApplicationStore(initialRows: ApplicationRecord[] = []): ApplicationStore {
  let nextId = Math.max(0, ...initialRows.map((row) => row.id)) + 1;
  const rows: ApplicationRecord[] = initialRows.map((row) => ({
    ...row,
    notesLog: row.notesLog ? row.notesLog.map((note) => ({ ...note })) : null,
  }));

  const findWritable = (id: number, userId: number, isAdmin = false) => {
    const index = rows.findIndex((row) => row.id === id && canAccess(userId, row.userId, isAdmin));
    return index >= 0 ? index : null;
  };

  return {
    async list(userId) {
      return rows
        .filter((row) => row.userId === userId)
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
    },
    async create(input) {
      const now = new Date();
      const row: ApplicationRecord = {
        id: nextId++,
        userId: input.userId,
        company: input.company,
        role: input.role,
        status: input.status ?? "saved",
        url: input.url ?? null,
        notes: input.notes ?? null,
        salary: input.salary ?? null,
        location: input.location ?? null,
        appliedAt: now.toISOString(),
        updatedAt: now.toISOString(),
        notesLog: null,
      };
      rows.push(row);
      return row;
    },
    async update(id, userId, input, isAdmin) {
      const index = findWritable(id, userId, isAdmin);
      if (index === null) return null;
      const row = rows[index]!;
      const updated: ApplicationRecord = { ...row, ...input, updatedAt: new Date().toISOString() };
      rows[index] = updated;
      return updated;
    },
    async delete(id, userId, isAdmin) {
      const index = findWritable(id, userId, isAdmin);
      if (index === null) return false;
      rows.splice(index, 1);
      return true;
    },
    async addNote(id, userId, text, isAdmin) {
      const index = findWritable(id, userId, isAdmin);
      if (index === null) return null;
      const row = rows[index]!;
      const notesLog = [...(row.notesLog ?? []), { text, createdAt: new Date().toISOString() }];
      const updated = { ...row, notesLog, updatedAt: new Date().toISOString() };
      rows[index] = updated;
      return updated;
    },
    async deleteNote(id, userId, noteIndex, isAdmin) {
      const index = findWritable(id, userId, isAdmin);
      if (index === null) return null;
      const row = rows[index]!;
      const notesLog = [...(row.notesLog ?? [])];
      if (noteIndex < 0 || noteIndex >= notesLog.length) return null;
      notesLog.splice(noteIndex, 1);
      const updated = { ...row, notesLog: notesLog.length > 0 ? notesLog : null, updatedAt: new Date().toISOString() };
      rows[index] = updated;
      return updated;
    },
  };
}

export function createDbApplicationStore(): ApplicationStore {
  async function findOwned(id: number, userId: number, isAdmin = false) {
    const [row] = await db
      .select()
      .from(jobApplicationsTable)
      .where(isAdmin
        ? eq(jobApplicationsTable.id, id)
        : and(eq(jobApplicationsTable.id, id), eq(jobApplicationsTable.userId, userId)))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  return {
    async list(userId) {
      const rows = await db
        .select()
        .from(jobApplicationsTable)
        .where(eq(jobApplicationsTable.userId, userId))
        .orderBy(desc(jobApplicationsTable.updatedAt));
      return rows.map(mapRow);
    },
    async create(input) {
      const [row] = await db
        .insert(jobApplicationsTable)
        .values({
          userId: input.userId,
          company: input.company,
          role: input.role,
          status: toDbStatus(input.status ?? "saved"),
          url: input.url ?? null,
          notes: input.notes ?? null,
          salary: input.salary ?? null,
          location: input.location ?? null,
        })
        .returning();
      return mapRow(row!);
    },
    async update(id, userId, input, isAdmin) {
      const existing = await findOwned(id, userId, isAdmin);
      if (!existing) return null;
      const values: Partial<typeof jobApplicationsTable.$inferInsert> = { updatedAt: new Date() };
      if (input.company !== undefined) values.company = input.company;
      if (input.role !== undefined) values.role = input.role;
      if (input.status !== undefined) values.status = toDbStatus(input.status);
      if (input.url !== undefined) values.url = input.url;
      if (input.notes !== undefined) values.notes = input.notes;
      if (input.salary !== undefined) values.salary = input.salary;
      if (input.location !== undefined) values.location = input.location;
      const [row] = await db
        .update(jobApplicationsTable)
        .set(values)
        .where(eq(jobApplicationsTable.id, id))
        .returning();
      return row ? mapRow(row) : null;
    },
    async delete(id, userId, isAdmin) {
      const existing = await findOwned(id, userId, isAdmin);
      if (!existing) return false;
      await db.delete(jobApplicationsTable).where(eq(jobApplicationsTable.id, id));
      return true;
    },
    async addNote(id, userId, text, isAdmin) {
      const existing = await findOwned(id, userId, isAdmin);
      if (!existing) return null;
      const notesLog = [...(existing.notesLog ?? []), { text, createdAt: new Date().toISOString() }];
      const [row] = await db
        .update(jobApplicationsTable)
        .set({ notesLog, updatedAt: new Date() })
        .where(eq(jobApplicationsTable.id, id))
        .returning();
      return row ? mapRow(row) : null;
    },
    async deleteNote(id, userId, noteIndex, isAdmin) {
      const existing = await findOwned(id, userId, isAdmin);
      if (!existing) return null;
      const notesLog = [...(existing.notesLog ?? [])];
      if (noteIndex < 0 || noteIndex >= notesLog.length) return null;
      notesLog.splice(noteIndex, 1);
      const [row] = await db
        .update(jobApplicationsTable)
        .set({ notesLog: notesLog.length > 0 ? notesLog : null, updatedAt: new Date() })
        .where(eq(jobApplicationsTable.id, id))
        .returning();
      return row ? mapRow(row) : null;
    },
  };
}

function parseId(value: string | undefined): number | null {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseStatus(value: unknown): ApplicationStatus | undefined {
  if (["saved", "applied", "interview", "offer", "rejected"].includes(String(value))) {
    return value as ApplicationStatus;
  }
  return undefined;
}

function buildUpdateInput(body: Record<string, unknown>): UpdateApplicationInput {
  const input: UpdateApplicationInput = {};
  if (typeof body.company === "string") input.company = body.company.trim();
  if (typeof body.role === "string") input.role = body.role.trim();
  if (body.status !== undefined) {
    const status = parseStatus(body.status);
    if (status) input.status = status;
  }
  if (body.url !== undefined) input.url = normalizeOptionalText(body.url);
  if (body.notes !== undefined) input.notes = normalizeOptionalText(body.notes);
  if (body.salary !== undefined) input.salary = normalizeOptionalText(body.salary);
  if (body.location !== undefined) input.location = normalizeOptionalText(body.location);
  return input;
}

export function createApplicationsRouter({ store = createDbApplicationStore() }: { store?: ApplicationStore } = {}) {
  const router = Router();

  router.get("/:userId", requireAuth, async (req, res) => {
    const requestedUserId = parseId(req.params.userId);
    if (!requestedUserId) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }
    if (!canAccess(req.user!.id, requestedUserId, req.user!.role === "admin")) {
      res.status(403).json({ code: "APPLICATIONS_USER_MISMATCH", error: "Puoi consultare solo le tue candidature" });
      return;
    }
    try {
      const applications = await store.list(requestedUserId);
      res.json({ applications, status: applications.length > 0 ? "ok" : "empty", totalCount: applications.length });
    } catch (err) {
      req.log?.error?.({ err }, "applications get error");
      if (
        sendOptionalReadFallback(req, res, err, "applications.list", {
          applications: [],
          ...APPLICATIONS_NOT_CONFIGURED,
          totalCount: 0,
        })
      ) return;
      res.status(500).json({ error: "Errore nel caricamento delle candidature" });
    }
  });

  router.post("/", requireAuth, async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const company = typeof body.company === "string" ? body.company.trim() : "";
      const role = typeof body.role === "string" ? body.role.trim() : "";
      if (!company || !role) {
        res.status(400).json({ error: "company e role sono obbligatori" });
        return;
      }
      const application = await store.create({
        userId: req.user!.id,
        company,
        role,
        status: parseStatus(body.status) ?? "saved",
        url: normalizeOptionalText(body.url),
        notes: normalizeOptionalText(body.notes),
        salary: normalizeOptionalText(body.salary),
        location: normalizeOptionalText(body.location),
      });
      res.status(201).json(application);
    } catch (err) {
      req.log?.error?.({ err }, "applications create error");
      if (sendPersistenceWriteError(req, res, err, "applications.create")) return;
      res.status(500).json({ error: "Errore nella creazione dell'applicazione" });
    }
  });

  router.patch("/:id", requireAuth, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "id non valido" });
        return;
      }
      const application = await store.update(id, req.user!.id, buildUpdateInput(req.body as Record<string, unknown>), req.user!.role === "admin");
      if (!application) {
        res.status(404).json({ error: "Candidatura non trovata" });
        return;
      }
      res.json(application);
    } catch (err) {
      req.log?.error?.({ err }, "applications update error");
      if (sendPersistenceWriteError(req, res, err, "applications.update")) return;
      res.status(500).json({ error: "Errore nell'aggiornamento dell'applicazione" });
    }
  });

  router.delete("/:id", requireAuth, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      if (!id) {
        res.status(400).json({ error: "id non valido" });
        return;
      }
      const deleted = await store.delete(id, req.user!.id, req.user!.role === "admin");
      if (!deleted) {
        res.status(404).json({ error: "Candidatura non trovata" });
        return;
      }
      res.status(204).end();
    } catch (err) {
      req.log?.error?.({ err }, "applications delete error");
      if (sendPersistenceWriteError(req, res, err, "applications.delete")) return;
      res.status(500).json({ error: "Errore nell'eliminazione dell'applicazione" });
    }
  });

  router.post("/:id/notes", requireAuth, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const text = normalizeOptionalText((req.body as Record<string, unknown>).text);
      if (!id || !text) {
        res.status(400).json({ error: "Nota non valida" });
        return;
      }
      const application = await store.addNote(id, req.user!.id, text, req.user!.role === "admin");
      if (!application) {
        res.status(404).json({ error: "Candidatura non trovata" });
        return;
      }
      res.json(application);
    } catch (err) {
      req.log?.error?.({ err }, "applications note create error");
      if (sendPersistenceWriteError(req, res, err, "applications.notes.create")) return;
      res.status(500).json({ error: "Errore nell'aggiunta della nota" });
    }
  });

  router.delete("/:id/notes/:noteIndex", requireAuth, async (req, res) => {
    try {
      const id = parseId(req.params.id);
      const noteIndex = Number.parseInt(req.params.noteIndex ?? "", 10);
      if (!id || !Number.isInteger(noteIndex)) {
        res.status(400).json({ error: "Nota non valida" });
        return;
      }
      const application = await store.deleteNote(id, req.user!.id, noteIndex, req.user!.role === "admin");
      if (!application) {
        res.status(404).json({ error: "Candidatura non trovata" });
        return;
      }
      res.json(application);
    } catch (err) {
      req.log?.error?.({ err }, "applications note delete error");
      if (sendPersistenceWriteError(req, res, err, "applications.notes.delete")) return;
      res.status(500).json({ error: "Errore nell'eliminazione della nota" });
    }
  });

  return router;
}

export default createApplicationsRouter();
