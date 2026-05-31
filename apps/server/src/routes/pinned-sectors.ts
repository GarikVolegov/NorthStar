import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";

export interface PinnedSectorRecord {
  userId: number;
  sectorId: number;
  sectorName: string | null;
  pinnedAt: Date;
}

export interface PinnedSectorsStore {
  list(userId: number): Promise<PinnedSectorRecord[]>;
  pin(userId: number, sectorId: number): Promise<"created" | "exists" | "limit">;
  unpin(userId: number, sectorId: number): Promise<void>;
}

const pinSchema = z.object({
  sectorId: z.coerce.number().int().positive(),
}).strict();

export function createPinnedSectorsRouter({ store = dbPinnedSectorsStore }: { store?: PinnedSectorsStore } = {}) {
  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    const pinnedSectors = await store.list(req.user!.id);
    res.json({ pinnedSectors: pinnedSectors.map(serializePinnedSector) });
  });

  router.post("/", requireAuth, async (req, res) => {
    const parsed = pinSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "sectorId non valido" });
      return;
    }

    const result = await store.pin(req.user!.id, parsed.data.sectorId);
    if (result === "limit") {
      res.status(409).json({ error: "Puoi pinnare al massimo 3 settori" });
      return;
    }

    res.status(result === "created" ? 201 : 200).json({ ok: true });
  });

  router.delete("/:sectorId", requireAuth, async (req, res) => {
    const sectorId = Number(req.params.sectorId);
    if (!Number.isInteger(sectorId) || sectorId <= 0) {
      res.status(400).json({ error: "sectorId non valido" });
      return;
    }
    await store.unpin(req.user!.id, sectorId);
    res.json({ ok: true });
  });

  return router;
}

export const dbPinnedSectorsStore: PinnedSectorsStore = {
  async list(userId) {
    const { db, pinnedSectorsTable, sectorsTable } = await import("@workspace/db");
    const rows = await db
      .select({
        userId: pinnedSectorsTable.userId,
        sectorId: pinnedSectorsTable.sectorId,
        sectorName: sectorsTable.name,
        pinnedAt: pinnedSectorsTable.pinnedAt,
      })
      .from(pinnedSectorsTable)
      .leftJoin(sectorsTable, eq(sectorsTable.id, pinnedSectorsTable.sectorId))
      .where(eq(pinnedSectorsTable.userId, userId))
      .orderBy(asc(pinnedSectorsTable.pinnedAt))
      .limit(3);
    return rows;
  },

  async pin(userId, sectorId) {
    const { db, pinnedSectorsTable } = await import("@workspace/db");
    const existing = await this.list(userId);
    if (existing.some((row) => row.sectorId === sectorId)) return "exists";
    if (existing.length >= 3) return "limit";

    await db
      .insert(pinnedSectorsTable)
      .values({ userId, sectorId })
      .onConflictDoNothing();
    return "created";
  },

  async unpin(userId, sectorId) {
    const { db, pinnedSectorsTable } = await import("@workspace/db");
    await db
      .delete(pinnedSectorsTable)
      .where(and(eq(pinnedSectorsTable.userId, userId), eq(pinnedSectorsTable.sectorId, sectorId)));
  },
};

export function createMemoryPinnedSectorsStore(): PinnedSectorsStore {
  const rows = new Map<string, PinnedSectorRecord>();
  return {
    async list(userId) {
      return [...rows.values()]
        .filter((row) => row.userId === userId)
        .sort((a, b) => a.pinnedAt.getTime() - b.pinnedAt.getTime())
        .slice(0, 3);
    },
    async pin(userId, sectorId) {
      const key = `${userId}:${sectorId}`;
      if (rows.has(key)) return "exists";
      const currentCount = [...rows.values()].filter((row) => row.userId === userId).length;
      if (currentCount >= 3) return "limit";
      rows.set(key, { userId, sectorId, sectorName: `Sector ${sectorId}`, pinnedAt: new Date() });
      return "created";
    },
    async unpin(userId, sectorId) {
      rows.delete(`${userId}:${sectorId}`);
    },
  };
}

function serializePinnedSector(record: PinnedSectorRecord) {
  return {
    userId: record.userId,
    sectorId: record.sectorId,
    sectorName: record.sectorName,
    pinnedAt: record.pinnedAt.toISOString(),
  };
}

export default createPinnedSectorsRouter();
