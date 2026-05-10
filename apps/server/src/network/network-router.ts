/**
 * network-router.ts — /api/friends
 *
 * GET    /api/friends              — lista amici (status=accepted)
 * GET    /api/friends/requests     — richieste ricevute in attesa
 * GET    /api/friends/suggestions  — utenti suggeriti con matchScore (0-100)
 * GET    /api/friends/search       — ricerca utenti per nome (?q=&sector=)
 * POST   /api/friends/request/:id  — invia richiesta di amicizia
 * PUT    /api/friends/:id/accept   — accetta una richiesta ricevuta
 * DELETE /api/friends/:id          — rimuovi amico o rifiuta richiesta
 *
 * Algoritmo matchScore (0-100):
 *   - Stesso settore           → +50 pt
 *   - Stesso journeyType       → +30 pt
 *   - |deltaXP| <= 2000        → +20 * (1 - |deltaXP| / 2000) pt (lineare)
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
import { eq, or, and, notInArray, ilike, sql } from "drizzle-orm";

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
  matchScore?: number;
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

/**
 * Restituisce tutti gli ID già correlati all’utente (se stesso + connessioni
 * accepted/pending/blocked in entrambe le direzioni).
 * Usato per escludere utenti da suggestions e search.
 */
async function getExcludedIds(me: number): Promise<Set<number>> {
  const rows = await db
    .select()
    .from(friendshipsTable)
    .where(
      or(
        eq(friendshipsTable.requesterId, me),
        eq(friendshipsTable.receiverId, me),
      ),
    );
  const ids = new Set<number>([me]);
  for (const f of rows) {
    ids.add(f.requesterId);
    ids.add(f.receiverId);
  }
  return ids;
}

// ── Algoritmo matchScore ──────────────────────────────────────────────────────────
//
// Segnali (totale max 100):
//   1. sameSector    → 50 pt  — segnale più forte: stesso mondo lavorativo
//   2. sameJourney   → 30 pt  — stesso tipo di percorso (es. entrambi "in_crescita")
//   3. xpProximity   → 0-20pt — XP simile: se |delta| <= 2000 assegna punteggio
//                               lineare (2000 delta = 0pt, 0 delta = 20pt)
//
// Note:
//   - Se uno dei due utenti non ha sectorId/journeyType/totalXp
//     il segnale vale 0 (non penalizza, non premia).
//   - Il punteggio minimo restituito è 0, max 100.

type MatchInput = {
  sectorId: number | null;
  journeyType: string | null;
  totalXp: number | null;
};

function computeMatchScore(me: MatchInput, other: MatchInput): number {
  let score = 0;

  // Segnale 1: stesso settore (50 pt)
  if (me.sectorId !== null && other.sectorId !== null && me.sectorId === other.sectorId) {
    score += 50;
  }

  // Segnale 2: stesso journeyType (30 pt)
  if (
    me.journeyType !== null &&
    other.journeyType !== null &&
    me.journeyType === other.journeyType
  ) {
    score += 30;
  }

  // Segnale 3: vicinanza XP (0-20 pt)
  if (me.totalXp !== null && other.totalXp !== null) {
    const delta = Math.abs(me.totalXp - other.totalXp);
    if (delta <= 2000) {
      score += Math.round(20 * (1 - delta / 2000));
    }
  }

  return Math.min(100, Math.max(0, score));
}

// ── GET /api/friends — lista connessioni accettate ──────────────────────────

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

// ── GET /api/friends/requests — richieste in arrivo ────────────────────────

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

// ── GET /api/friends/suggestions — utenti suggeriti con matchScore ────────────

networkRouter.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const excludeIds = await getExcludedIds(me);

    // Profilo dell’utente corrente per il calcolo del match
    const meRow = await db
      .select({
        testSessionId: usersTable.testSessionId,
        journeyType:   usersTable.journeyType,
        totalXp:       usersTable.totalXp,
      })
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

    const myProfile: MatchInput = {
      sectorId:    mySectorId,
      journeyType: meRow?.journeyType ?? null,
      totalXp:     meRow?.totalXp ?? null,
    };

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
      .limit(50); // recupera più candidati per calcolare meglio il ranking

    // Calcola matchScore per ogni candidato e ordina DESC
    const scored = candidates
      .map((c) => ({
        id:          c.id,
        name:        c.name,
        avatarUrl:   c.avatarUrl,
        journeyType: c.journeyType,
        totalXp:     c.totalXp,
        sectorName:  c.sectorName,
        matchScore:  computeMatchScore(myProfile, {
          sectorId:    c.sectorId ?? null,
          journeyType: c.journeyType ?? null,
          totalXp:     c.totalXp ?? null,
        }),
      }))
      .sort((a, b) => b.matchScore - a.matchScore);

    res.json({ suggestions: scored.slice(0, 12) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /api/friends/search — ricerca utenti con matchScore ─────────────────
//
// Query params:
//   q       — stringa di ricerca sul nome (min 2 caratteri, max 80)
//   sector  — (opzionale) ID settore per filtrare
//   limit   — (opzionale) max risultati, default 15, max 30

networkRouter.get("/search", async (req: Request, res: Response) => {
  try {
    const me = uid(req);

    const rawQ = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (rawQ.length < 2) {
      res.status(400).json({ error: "Il termine di ricerca deve avere almeno 2 caratteri" });
      return;
    }
    if (rawQ.length > 80) {
      res.status(400).json({ error: "Termine di ricerca troppo lungo" });
      return;
    }

    const sectorFilter =
      typeof req.query.sector === "string" && req.query.sector !== ""
        ? parseInt(req.query.sector, 10)
        : null;

    const limit = Math.min(
      parseInt(typeof req.query.limit === "string" ? req.query.limit : "15", 10) || 15,
      30,
    );

    // Profilo dell’utente corrente per il calcolo del match
    const meRow = await db
      .select({
        testSessionId: usersTable.testSessionId,
        journeyType:   usersTable.journeyType,
        totalXp:       usersTable.totalXp,
      })
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

    const myProfile: MatchInput = {
      sectorId:    mySectorId,
      journeyType: meRow?.journeyType ?? null,
      totalXp:     meRow?.totalXp ?? null,
    };

    const excludeIds = await getExcludedIds(me);
    const namePattern = `%${rawQ}%`;

    const baseConditions = and(
      eq(usersTable.isPublic, true),
      notInArray(usersTable.id, [...excludeIds]),
      ilike(usersTable.name, namePattern),
      ...(sectorFilter !== null
        ? [eq(testSessionsTable.confirmedSectorId, sectorFilter)]
        : []),
    );

    const rows = await db
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
      .where(baseConditions)
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const results = rows.slice(0, limit);

    // Ordina: match nome esatto > startsWith > parziale; a parità matchScore DESC
    const q = rawQ.toLowerCase();
    const scored = results
      .map((r) => ({
        ...r,
        matchScore: computeMatchScore(myProfile, {
          sectorId:    r.sectorId ?? null,
          journeyType: r.journeyType ?? null,
          totalXp:     r.totalXp ?? null,
        }),
      }))
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aPrio = aName === q ? 2 : aName.startsWith(q) ? 1 : 0;
        const bPrio = bName === q ? 2 : bName.startsWith(q) ? 1 : 0;
        if (aPrio !== bPrio) return bPrio - aPrio;
        return b.matchScore - a.matchScore;
      });

    res.json({
      results: scored,
      total:   scored.length,
      hasMore,
      query:   rawQ,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── POST /api/friends/request/:targetId — invia richiesta ───────────────────

networkRouter.post("/request/:targetId", async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const targetId = parseInt(req.params.targetId, 10);

    if (isNaN(targetId) || targetId === me) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

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

// ── PUT /api/friends/:id/accept — accetta richiesta ─────────────────────────

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

// ── DELETE /api/friends/:id — rimuovi / rifiuta ───────────────────────────

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
