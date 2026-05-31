import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";
import { sendOptionalReadFallback, sendPersistenceWriteError } from "../lib/persistence";
import {
  createCertificateIssuer,
  type CertificateIssuer,
} from "../services/certificates/certificate-issuer";

export interface ObjectiveRecord {
  id: number;
  userId: number;
  text: string;
  category: string;
  progress: number;
  dueDate: string | null;
  completed: boolean;
  completedAt: Date | null;
  isCertifiableMilestone: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ObjectiveStore {
  list(userId: number): Promise<ObjectiveRecord[]>;
  hasAny(userId: number): Promise<boolean>;
  create(input: CreateObjectiveInput): Promise<ObjectiveRecord>;
  createMany(inputs: CreateObjectiveInput[]): Promise<ObjectiveRecord[]>;
  findByIdForUser(id: number, userId: number): Promise<ObjectiveRecord | null>;
  update(id: number, patch: Partial<ObjectiveRecord>): Promise<ObjectiveRecord>;
  delete(id: number): Promise<void>;
}

export type ObjectiveCertificateIssuer = Pick<CertificateIssuer, "issueMilestoneCertificate">;

interface CreateObjectiveInput {
  userId: number;
  text: string;
  category: string;
  dueDate: string | null;
  isCertifiableMilestone: boolean;
}

const createObjectiveSchema = z.object({
  text: z.string().min(3).max(200),
  category: z.string().default("altro"),
  dueDate: z.string().optional(),
  isCertifiableMilestone: z.boolean().optional(),
});

const updateObjectiveSchema = z.object({
  text: z.string().min(3).max(200).optional(),
  progress: z.number().min(0).max(100).optional(),
  completed: z.boolean().optional(),
  dueDate: z.string().nullable().optional(),
  isCertifiableMilestone: z.boolean().optional(),
});

const SEED_OBJECTIVES: Record<string, Array<{ text: string; category: string }>> = {
  indeciso: [
    { text: "Completa il test di personalita", category: "scoperta" },
    { text: "Esplora 3 settori professionali", category: "esplorazione" },
    { text: "Scegli il tuo percorso", category: "decisione" },
  ],
  dipendente: [
    { text: "Identifica 5 competenze chiave", category: "carriera" },
    { text: "Simula 3 colloqui di lavoro", category: "preparazione" },
    { text: "Invia 5 candidature", category: "ricerca" },
  ],
  autonomo: [
    { text: "Valida un'idea di business", category: "business" },
    { text: "Analizza 3 settori di mercato", category: "mercato" },
    { text: "Crea un business plan", category: "business" },
  ],
  azienda: [
    { text: "Esplora 5 profili personalita", category: "selezione" },
    { text: "Pubblica un annuncio di lavoro", category: "reclutamento" },
    { text: "Analizza 3 settori del mercato", category: "mercato" },
  ],
  investitore: [
    { text: "Analizza 5 settori in crescita", category: "analisi" },
    { text: "Confronta 2 settori tra loro", category: "analisi" },
    { text: "Leggi 3 report di mercato", category: "ricerca" },
  ],
};

export function createObjectivesRouter({
  store = dbObjectiveStore,
  certificateIssuer = createCertificateIssuer(),
}: {
  store?: ObjectiveStore;
  certificateIssuer?: ObjectiveCertificateIssuer;
} = {}) {
  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    try {
      const items = await store.list(req.user!.id);
      res.json(items);
    } catch (err) {
      req.log?.error?.({ err }, "objectives list error");
      if (sendOptionalReadFallback(req, res, err, "objectives.list", [])) return;
      res.status(500).json({ error: "Errore nel caricamento degli obiettivi" });
    }
  });

  router.post("/", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const data = createObjectiveSchema.parse(req.body);

      const item = await store.create({
        userId,
        text: data.text,
        category: data.category,
        dueDate: data.dueDate ?? null,
        isCertifiableMilestone: data.isCertifiableMilestone ?? false,
      });

      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Dati obiettivo non validi" });
        return;
      }
      req.log?.error?.({ err }, "objectives create error");
      if (sendPersistenceWriteError(req, res, err, "objectives.create")) return;
      res.status(500).json({ error: "Errore nella creazione dell'obiettivo" });
    }
  });

  router.post("/seed", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const journeyType = req.user!.journeyType ?? "indeciso";

      if (await store.hasAny(userId)) {
        res.json({ message: "Obiettivi gia presenti", count: 1 });
        return;
      }

      const defaults = SEED_OBJECTIVES[journeyType] ?? SEED_OBJECTIVES.indeciso ?? [];
      const inserted = await store.createMany(
        defaults.map((objective) => ({
          userId,
          text: objective.text,
          category: objective.category,
          dueDate: null,
          isCertifiableMilestone: true,
        })),
      );

      res.status(201).json({ message: "Obiettivi creati", objectives: inserted });
    } catch (err) {
      req.log?.error?.({ err }, "objectives seed error");
      if (sendPersistenceWriteError(req, res, err, "objectives.seed")) return;
      res.status(500).json({ error: "Errore nell'inizializzazione degli obiettivi" });
    }
  });

  router.patch("/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id ?? "", 10);
      const data = updateObjectiveSchema.parse(req.body);

      const existing = await store.findByIdForUser(id, userId);
      if (!existing) {
        res.status(404).json({ error: "Obiettivo non trovato" });
        return;
      }

      if (
        existing.completed &&
        data.isCertifiableMilestone !== undefined &&
        data.isCertifiableMilestone !== existing.isCertifiableMilestone
      ) {
        res.status(409).json({ error: "Il flag milestone non puo essere modificato dopo il completamento" });
        return;
      }

      const updateData: Partial<ObjectiveRecord> = { updatedAt: new Date() };
      if (data.text !== undefined) updateData.text = data.text;
      if (data.progress !== undefined) updateData.progress = data.progress;
      if (data.completed !== undefined) updateData.completed = data.completed;
      if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
      if (data.isCertifiableMilestone !== undefined) {
        updateData.isCertifiableMilestone = data.isCertifiableMilestone;
      }
      if (data.completed === true) {
        if (!existing.completed) updateData.completedAt = new Date();
        updateData.progress = 100;
      }
      if (data.completed === false) {
        updateData.completedAt = null;
      }

      const updated = await store.update(id, updateData);

      if (data.completed === true && !existing.completed && updated.isCertifiableMilestone) {
        await certificateIssuer.issueMilestoneCertificate({
          userId,
          userName: req.user!.name || req.user!.email || "Utente NorthStar",
          objectiveId: updated.id,
          objectiveText: updated.text,
          category: updated.category,
          completedAt: updated.completedAt ?? new Date(),
        });
      }

      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Dati obiettivo non validi" });
        return;
      }
      req.log?.error?.({ err }, "objectives update error");
      if (sendPersistenceWriteError(req, res, err, "objectives.update")) return;
      res.status(500).json({ error: "Errore nell'aggiornamento dell'obiettivo" });
    }
  });

  router.delete("/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const id = parseInt(req.params.id ?? "", 10);

      const existing = await store.findByIdForUser(id, userId);
      if (!existing) {
        res.status(404).json({ error: "Obiettivo non trovato" });
        return;
      }

      await store.delete(id);
      res.status(204).send();
    } catch (err) {
      req.log?.error?.({ err }, "objectives delete error");
      if (sendPersistenceWriteError(req, res, err, "objectives.delete")) return;
      res.status(500).json({ error: "Errore nell'eliminazione dell'obiettivo" });
    }
  });

  return router;
}

export const dbObjectiveStore: ObjectiveStore = {
  async list(userId) {
    const { db, userObjectivesTable } = await import("@workspace/db");
    const rows = await db
      .select()
      .from(userObjectivesTable)
      .where(eq(userObjectivesTable.userId, userId))
      .orderBy(desc(userObjectivesTable.createdAt));
    return rows.map(normalizeObjective);
  },

  async hasAny(userId) {
    const { db, userObjectivesTable } = await import("@workspace/db");
    const existing = await db
      .select({ id: userObjectivesTable.id })
      .from(userObjectivesTable)
      .where(eq(userObjectivesTable.userId, userId))
      .limit(1);
    return existing.length > 0;
  },

  async create(input) {
    const { db, userObjectivesTable } = await import("@workspace/db");
    const [item] = await db.insert(userObjectivesTable).values(input).returning();
    if (!item) throw new Error("Objective insert returned no row");
    return normalizeObjective(item);
  },

  async createMany(inputs) {
    if (inputs.length === 0) return [];
    const { db, userObjectivesTable } = await import("@workspace/db");
    const inserted = await db.insert(userObjectivesTable).values(inputs).returning();
    return inserted.map(normalizeObjective);
  },

  async findByIdForUser(id, userId) {
    const { db, userObjectivesTable } = await import("@workspace/db");
    const [existing] = await db
      .select()
      .from(userObjectivesTable)
      .where(and(eq(userObjectivesTable.id, id), eq(userObjectivesTable.userId, userId)))
      .limit(1);
    return existing ? normalizeObjective(existing) : null;
  },

  async update(id, patch) {
    const { db, userObjectivesTable } = await import("@workspace/db");
    const [updated] = await db
      .update(userObjectivesTable)
      .set(patch)
      .where(eq(userObjectivesTable.id, id))
      .returning();
    if (!updated) throw new Error("Objective update returned no row");
    return normalizeObjective(updated);
  },

  async delete(id) {
    const { db, userObjectivesTable } = await import("@workspace/db");
    await db.delete(userObjectivesTable).where(eq(userObjectivesTable.id, id));
  },
};

export function createMemoryObjectiveStore(): ObjectiveStore {
  let nextId = 1;
  const rows = new Map<number, ObjectiveRecord>();

  return {
    async list(userId) {
      return [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    },
    async hasAny(userId) {
      return [...rows.values()].some((row) => row.userId === userId);
    },
    async create(input) {
      const now = new Date();
      const row: ObjectiveRecord = {
        id: nextId++,
        userId: input.userId,
        text: input.text,
        category: input.category,
        progress: 0,
        dueDate: input.dueDate,
        completed: false,
        completedAt: null,
        isCertifiableMilestone: input.isCertifiableMilestone,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      rows.set(row.id, row);
      return row;
    },
    async createMany(inputs) {
      const created: ObjectiveRecord[] = [];
      for (const input of inputs) {
        created.push(await this.create(input));
      }
      return created;
    },
    async findByIdForUser(id, userId) {
      const row = rows.get(id);
      return row?.userId === userId ? row : null;
    },
    async update(id, patch) {
      const row = rows.get(id);
      if (!row) throw new Error("Objective not found");
      const updated: ObjectiveRecord = {
        ...row,
        ...patch,
        completed: typeof patch.completed === "boolean" ? patch.completed : row.completed,
        isCertifiableMilestone:
          typeof patch.isCertifiableMilestone === "boolean"
            ? patch.isCertifiableMilestone
            : row.isCertifiableMilestone,
      };
      rows.set(id, updated);
      return updated;
    },
    async delete(id) {
      rows.delete(id);
    },
  };
}

function normalizeObjective(row: {
  id: number;
  userId: number;
  text: string;
  category: string;
  progress: number;
  dueDate: string | null;
  completed: boolean;
  completedAt: Date | null;
  isCertifiableMilestone?: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}): ObjectiveRecord {
  return {
    ...row,
    isCertifiableMilestone: row.isCertifiableMilestone ?? false,
  };
}

export default createObjectivesRouter();
