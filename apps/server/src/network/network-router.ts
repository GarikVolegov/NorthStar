/**
 * network-router.ts — /api/friends
 *
 * GET    /api/friends              — lista amici (status=accepted)
 * GET    /api/friends/requests     — richieste ricevute in attesa
 * GET    /api/friends/suggestions  — utenti suggeriti (stesso settore)
 * POST   /api/friends/request/:id  — invia richiesta di amicizia
 * PUT    /api/friends/:id/accept   — accetta una richiesta ricevuta
 * DELETE /api/friends/:id          — rimuovi amico o rifiuta richiesta
 *
 * Tutti gli endpoint richiedono autenticazione (requireAuth montato in index.ts).
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  friendshipsTable,
  usersTable,
  testSessionsTable,
  sectorsTable,
} from "@workspace/db";
import { eq, or, and, ne, notInArray, sql } from "drizzle-orm";

export const networkRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

type PublicUser = {
  id: number;
  name: string;
  avatarUrl: string | null;
  sectorName: string | null;
  journeyType: string | null;
  totalXp: number | null;
};

async function getPublicUser(userId: number): Promise<PublicUser | null> {
  const row = await db
    .select({
      id:          usersTable.id,
      name:        usersTable.name,
      avatarUrl:   usersTable.avatarUrl,
      journeyType: usersTable.journeyType,
      totalXp:     usersTable.totalXp,
      sectorName:  sectorsTable.name,
    })
    .from(usersTable)
    .leftJoin(testSessionsTable, eq(usersTable.testSessionId, testSessionsTable.id))
    .leftJoin(sectorsTable, eq(testSessionsTable.confirmedSectorId, sectorsTable.id))
    .where(eq(usersTable.id, userId))
    .limit(1)
    .then((r) => r[0] ?? null);
  return row;
}

// ── GET /api/friends — lista connessioni accettate ────────────────────────────

networkRouter.get("/", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const rows = await db
      .select()
      .from(friendshipsTable)
      .where(
        and(
          or(
            eq(friendshipsTable.requesterId, me),
            eq(friendshipsTable.receiverId, me),
          ),
          eq(friendshipsTable.status, "accepted"),
        ),
      );

    const friends = await Promise.all(
      rows.map(async (f) => {
        const otherId = f.requesterId === me ? f.receiverId : f.requesterId;
        const user = await getPublicUser(otherId);
        return { friendshipId: f.id, since: f.updatedAt, user };
      }),
    );

    res.json({ friends: friends.filter((f) => f.user !== null) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /api/friends/requests — richieste in arrivo ───────────────────────────

networkRouter.get("/requests", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const rows = await db
      .select()
      .from(friendshipsTable)
      .where(
        and(
          eq(friendshipsTable.receiverId, me),
          eq(friendshipsTable.status, "pending"),
        ),
      );

    const requests = await Promise.all(
      rows.map(async (f) => {
        const user = await getPublicUser(f.requesterId);
        return { friendshipId: f.id, sentAt: f.createdAt, user };
      }),
    );

    res.json({ requests: requests.filter((r) => r.user !== null) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /api/friends/suggestions — utenti suggeriti ───────────────────────────

networkRouter.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const me = uid(req);

    // ID di utenti già connessi o con richiesta pendente
    const existing = await db
      .select()
      .from(friendshipsTable)
      .where(
        or(
          eq(friendshipsTable.requesterId, me),
          eq(friendshipsTable.receiverId, me),
        ),
      );

    const excludeIds = new Set<number>([me]);
    for (const f of existing) {
      excludeIds.add(f.requesterId);
      excludeIds.add(f.receiverId);
    }

    // Trova sectorId dell'utente corrente
    const meRow = await db
      .select({ testSessionId: usersTable.testSessionId })
      .from(usersTable)
      .where(eq(usersTable.id, me))
      .limit(1)
      .then((r) => r[0]);

    let mySectorId: number | null = null;
    if (meRow?.testSessionId) {
      const session = await db
        .select({ confirmedSectorId: testSessionsTable.confirmedSectorId })
        .from(testSessionsTable)
        .where(eq(testSessionsTable.id, meRow.testSessionId))
        .limit(1)
        .then((r) => r[0]);
      mySectorId = session?.confirmedSectorId ?? null;
    }

    // Utenti con stesso settore, non già connessi, pubblici
    const candidates = await db
      .select({
        id:          usersTable.id,
        name:        usersTable.name,
        avatarUrl:   usersTable.avatarUrl,
        journeyType: usersTable.journeyType,
        totalXp:     usersTable.totalXp,
        sectorName:  sectorsTable.name,
        sectorId:    testSessionsTable.confirmedSectorId,
      })
      .from(usersTable)
      .leftJoin(testSessionsTable, eq(usersTable.testSessionId, testSessionsTable.id))
      .leftJoin(sectorsTable, eq(testSessionsTable.confirmedSectorId, sectorsTable.id))
      .where(
        and(
          eq(usersTable.isPublic, true),
          notInArray(usersTable.id, [...excludeIds]),
        ),
      )
      .limit(20);

    // Ordina: stesso settore prima
    const sorted = candidates.sort((a, b) => {
      const aMatch = mySectorId && a.sectorId === mySectorId ? 1 : 0;
      const bMatch = mySectorId && b.sectorId === mySectorId ? 1 : 0;
      return bMatch - aMatch;
    });

    res.json({ suggestions: sorted.slice(0, 12) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── POST /api/friends/request/:targetId — invia richiesta ─────────────────────

networkRouter.post("/request/:targetId", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const targetId = parseInt(req.params.targetId, 10);

    if (isNaN(targetId) || targetId === me) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    // Verifica che non esista già
    const existing = await db
      .select()
      .from(friendshipsTable)
      .where(
        or(
          and(eq(friendshipsTable.requesterId, me), eq(friendshipsTable.receiverId, targetId)),
          and(eq(friendshipsTable.requesterId, targetId), eq(friendshipsTable.receiverId, me)),
        ),
      )
      .limit(1)
      .then((r) => r[0]);

    if (existing) {
      res.status(409).json({ error: "Relazione già esistente", status: existing.status });
      return;
    }

    const [friendship] = await db
      .insert(friendshipsTable)
      .values({ requesterId: me, receiverId: targetId, status: "pending" })
      .returning();

    res.status(201).json({ friendship });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── PUT /api/friends/:id/accept — accetta richiesta ───────────────────────────

networkRouter.put("/:id/accept", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const friendshipId = parseInt(req.params.id, 10);

    const row = await db
      .select()
      .from(friendshipsTable)
      .where(eq(friendshipsTable.id, friendshipId))
      .limit(1)
      .then((r) => r[0]);

    if (!row) { res.status(404).json({ error: "Richiesta non trovata" }); return; }
    if (row.receiverId !== me) { res.status(403).json({ error: "Non autorizzato" }); return; }
    if (row.status !== "pending") { res.status(409).json({ error: "Stato non valido" }); return; }

    const [updated] = await db
      .update(friendshipsTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(friendshipsTable.id, friendshipId))
      .returning();

    res.json({ friendship: updated });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── DELETE /api/friends/:id — rimuovi / rifiuta ────────────────────────────────

networkRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const friendshipId = parseInt(req.params.id, 10);

    const row = await db
      .select()
      .from(friendshipsTable)
      .where(eq(friendshipsTable.id, friendshipId))
      .limit(1)
      .then((r) => r[0]);

    if (!row) { res.status(404).json({ error: "Connessione non trovata" }); return; }
    if (row.requesterId !== me && row.receiverId !== me) {
      res.status(403).json({ error: "Non autorizzato" }); return;
    }

    await db.delete(friendshipsTable).where(eq(friendshipsTable.id, friendshipId));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});
