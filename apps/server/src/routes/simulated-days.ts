import { Router } from "express";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import {
  buildTryADayScenes,
  computeTryADayDebrief,
  pickTryADaySuggestions,
  type TryADayDebrief,
  type TryADayProfession,
  type TryADayResponses,
  type TryADayScene,
} from "@workspace/ai-server";
import { db, professionsTable, simulatedDaysTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

export interface SimulatedDayRecord {
  id: number;
  userId: number;
  professionId: number;
  roleTitle: string;
  sector: string;
  scenesJson: TryADayScene[];
  responsesJson: TryADayResponses | null;
  debriefJson: TryADayDebrief | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimulatedDaysStore {
  getProfession(professionId: number): Promise<TryADayProfession | null>;
  listActiveProfessions(): Promise<TryADayProfession[]>;
  createSimulation(input: {
    userId: number;
    profession: TryADayProfession;
    scenes: TryADayScene[];
  }): Promise<SimulatedDayRecord>;
  getSimulationForUser(id: number, userId: number): Promise<SimulatedDayRecord | null>;
  completeSimulation(input: {
    id: number;
    userId: number;
    responses: TryADayResponses;
    debrief: TryADayDebrief;
  }): Promise<SimulatedDayRecord | null>;
  getLatestCompletedForProfession(userId: number, professionId: number): Promise<SimulatedDayRecord | null>;
}

export const dbSimulatedDaysStore: SimulatedDaysStore = {
  async getProfession(professionId) {
    const [profession] = await db
      .select()
      .from(professionsTable)
      .where(and(eq(professionsTable.id, professionId), eq(professionsTable.isActive, true)))
      .limit(1);
    return profession ?? null;
  },

  async listActiveProfessions() {
    return db.select().from(professionsTable).where(eq(professionsTable.isActive, true));
  },

  async createSimulation({ userId, profession, scenes }) {
    const [record] = await db
      .insert(simulatedDaysTable)
      .values({
        userId,
        professionId: profession.id,
        roleTitle: profession.title,
        sector: profession.sector,
        scenesJson: scenes,
      })
      .returning();
    if (!record) throw new Error("simulated_days insert returned no row");
    return normalizeRecord(record);
  },

  async getSimulationForUser(id, userId) {
    const [record] = await db
      .select()
      .from(simulatedDaysTable)
      .where(and(eq(simulatedDaysTable.id, id), eq(simulatedDaysTable.userId, userId)))
      .limit(1);
    return record ? normalizeRecord(record) : null;
  },

  async completeSimulation({ id, userId, responses, debrief }) {
    const [record] = await db
      .update(simulatedDaysTable)
      .set({
        responsesJson: responses,
        debriefJson: debrief,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(simulatedDaysTable.id, id), eq(simulatedDaysTable.userId, userId)))
      .returning();
    return record ? normalizeRecord(record) : null;
  },

  async getLatestCompletedForProfession(userId, professionId) {
    const [record] = await db
      .select()
      .from(simulatedDaysTable)
      .where(
        and(
          eq(simulatedDaysTable.userId, userId),
          eq(simulatedDaysTable.professionId, professionId),
          isNotNull(simulatedDaysTable.completedAt),
        ),
      )
      .orderBy(desc(simulatedDaysTable.completedAt), desc(simulatedDaysTable.createdAt))
      .limit(1);
    if (!record?.completedAt) return null;
    return normalizeRecord(record);
  },
};

function normalizeRecord(record: typeof simulatedDaysTable.$inferSelect): SimulatedDayRecord {
  return {
    id: record.id,
    userId: record.userId,
    professionId: record.professionId,
    roleTitle: record.roleTitle,
    sector: record.sector,
    scenesJson: record.scenesJson as TryADayScene[],
    responsesJson: record.responsesJson as TryADayResponses | null,
    debriefJson: record.debriefJson as TryADayDebrief | null,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function parsePositiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseResponses(value: unknown): TryADayResponses {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as TryADayResponses;
}

export function createSimulatedDaysRouter({ store = dbSimulatedDaysStore }: { store?: SimulatedDaysStore } = {}) {
  const router = Router();

  router.post("/generate", requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const professionId = parsePositiveId(req.body?.professionId);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!professionId) {
      res.status(400).json({ error: "professionId non valido" });
      return;
    }

    const profession = await store.getProfession(professionId);
    if (!profession) {
      res.status(404).json({ error: "Professione non trovata" });
      return;
    }

    const scenes = buildTryADayScenes(profession);
    const record = await store.createSimulation({ userId, profession, scenes });
    res.json({
      simulationId: record.id,
      professionId: record.professionId,
      roleTitle: record.roleTitle,
      sector: record.sector,
      scenes: record.scenesJson,
      completedAt: record.completedAt,
    });
  });

  router.post("/:id/complete", requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const id = parsePositiveId(req.params.id);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!id) {
      res.status(400).json({ error: "simulation id non valido" });
      return;
    }

    const record = await store.getSimulationForUser(id, userId);
    if (!record) {
      res.status(404).json({ error: "Simulazione non trovata" });
      return;
    }

    const profession = await store.getProfession(record.professionId);
    const candidates = await store.listActiveProfessions();
    const responses = parseResponses(req.body?.responses);
    const debrief = computeTryADayDebrief(record.scenesJson, responses);
    if (profession) {
      debrief.suggestions = pickTryADaySuggestions(profession, candidates);
    }

    const completed = await store.completeSimulation({ id, userId, responses, debrief });
    if (!completed) {
      res.status(404).json({ error: "Simulazione non trovata" });
      return;
    }

    res.json({
      simulationId: completed.id,
      professionId: completed.professionId,
      roleTitle: completed.roleTitle,
      sector: completed.sector,
      debrief: completed.debriefJson,
      completedAt: completed.completedAt?.toISOString() ?? null,
    });
  });

  router.get("/by-profession/:professionId", requireAuth, async (req, res) => {
    const userId = req.user?.id;
    const professionId = parsePositiveId(req.params.professionId);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!professionId) {
      res.status(400).json({ error: "professionId non valido" });
      return;
    }

    const record = await store.getLatestCompletedForProfession(userId, professionId);
    if (!record) {
      res.json({ completed: false });
      return;
    }

    res.json({
      completed: true,
      simulationId: record.id,
      professionId: record.professionId,
      roleTitle: record.roleTitle,
      sector: record.sector,
      debrief: record.debriefJson,
      completedAt: record.completedAt?.toISOString() ?? null,
    });
  });

  return router;
}

export function createMemorySimulatedDaysStore(): SimulatedDaysStore {
  let nextId = 1;
  const professions: TryADayProfession[] = [
    {
      id: 7,
      title: "Data Analyst",
      sector: "Tecnologia",
      description: "Trasforma dati grezzi in decisioni leggibili.",
      skills: ["SQL", "Storytelling", "Dashboard"],
      riasecFit: ["I", "C"],
      workModes: ["ibrido", "team"],
      salaryRange: "32-45k",
      growthOutlook: "alta",
      autonomyScore: 6,
      stabilityScore: 7,
    },
    {
      id: 8,
      title: "Business Analyst",
      sector: "Tecnologia",
      skills: ["SQL", "Storytelling"],
      riasecFit: ["I", "E"],
      workModes: ["team"],
    },
    {
      id: 9,
      title: "Artigiano digitale",
      sector: "Design",
      skills: ["Manualita"],
      riasecFit: ["R"],
      workModes: ["solo"],
    },
  ];
  const records = new Map<number, SimulatedDayRecord>();

  return {
    async getProfession(professionId) {
      return professions.find((profession) => profession.id === professionId) ?? null;
    },
    async listActiveProfessions() {
      return professions;
    },
    async createSimulation({ userId, profession, scenes }) {
      const now = new Date();
      const record: SimulatedDayRecord = {
        id: nextId++,
        userId,
        professionId: profession.id,
        roleTitle: profession.title,
        sector: profession.sector,
        scenesJson: scenes,
        responsesJson: null,
        debriefJson: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      records.set(record.id, record);
      return record;
    },
    async getSimulationForUser(id, userId) {
      const record = records.get(id);
      return record?.userId === userId ? record : null;
    },
    async completeSimulation({ id, userId, responses, debrief }) {
      const record = records.get(id);
      if (!record || record.userId !== userId) return null;
      const next = {
        ...record,
        responsesJson: responses,
        debriefJson: debrief,
        completedAt: new Date(),
        updatedAt: new Date(),
      };
      records.set(id, next);
      return next;
    },
    async getLatestCompletedForProfession(userId, professionId) {
      return (
        [...records.values()]
          .filter((record) => record.userId === userId && record.professionId === professionId && record.completedAt)
          .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0] ?? null
      );
    },
  };
}

export default createSimulatedDaysRouter();
